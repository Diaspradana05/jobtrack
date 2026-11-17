import type { Metadata } from "next";
import { AlertTriangle, CalendarClock, CalendarDays } from "lucide-react";
import AgendaList from "@/components/AgendaList";
import EmptyState from "@/components/EmptyState";
import ReminderSettings, { type ReminderRow } from "@/components/ReminderSettings";
import { AddScheduleButton } from "@/components/ScheduleDialog";
import { createClient } from "@/lib/supabase/server";
import { daysBetween, nowWib, sortSchedules, urgency, type Schedule } from "@/lib/schedule";

export const metadata: Metadata = { title: "Agenda" };

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const supabase = createClient();
  const [schRes, appRes, userRes, remRes] = await Promise.all([
    supabase.from("schedules").select("*, applications(company, position)").order("due_date").order("due_time", { nullsFirst: true }),
    supabase.from("applications").select("id, company, position").order("created_at", { ascending: false }),
    supabase.auth.getUser(),
    supabase.from("reminder_settings").select("*").maybeSingle(),
  ]);
  const user = userRes.data.user;
  const apps = appRes.data ?? [];

  if (schRes.error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="page-title">Agenda</h1>
        <div className="card space-y-2">
          <p className="font-bold">Tabel jadwal belum dibuat</p>
          <p className="text-sm text-stone-600">
            Buka Supabase → SQL Editor, lalu jalankan isi file <code className="rounded bg-stone-100 px-1">supabase/migration-schedules.sql</code>{" "}
            sekali saja. Setelah itu muat ulang halaman ini.
          </p>
          <p className="text-xs text-stone-400">Detail: {schRes.error.message}</p>
        </div>
      </div>
    );
  }

  const all = (schRes.data ?? []) as Schedule[];
  const now = nowWib();
  const pending = all.filter((s) => !s.done).sort(sortSchedules);

  const overdue = pending.filter((s) => urgency(s, now) === "overdue");
  const today = pending.filter((s) => urgency(s, now) === "today");
  const upcoming = pending.filter((s) => {
    const diff = daysBetween(now.date, s.due_date);
    return diff >= 1 && diff <= 7;
  });
  const later = pending.filter((s) => daysBetween(now.date, s.due_date) > 7);
  const done = all
    .filter((s) => s.done)
    .sort((a, b) => b.due_date.localeCompare(a.due_date))
    .slice(0, 10);

  const stats = [
    { label: "Terlambat", value: overdue.length, icon: AlertTriangle, tone: overdue.length ? "text-rose-600" : "text-brand" },
    { label: "Hari ini", value: today.length, icon: CalendarClock, tone: today.length ? "text-amber-600" : "text-brand" },
    { label: "7 hari ke depan", value: upcoming.length, icon: CalendarDays, tone: "text-brand" },
  ];

  const sections: { title: string; items: Schedule[]; empty?: string }[] = [
    { title: "Terlambat", items: overdue },
    { title: "Hari ini", items: today },
    { title: "7 hari ke depan", items: upcoming },
    { title: "Nanti", items: later },
    { title: "Selesai (terbaru)", items: done },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="text-sm text-stone-500">Deadline lamaran, jadwal interview, dan follow-up. Waktu dalam WIB.</p>
        </div>
        <AddScheduleButton apps={apps} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card card-hover">
            <div className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>
              <Icon className="h-4 w-4" /> {label}
            </div>
            <p className="mt-2 text-3xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>

      {pending.length === 0 && done.length === 0 ? (
        <div className="card p-0">
          <EmptyState
            icon={CalendarDays}
            title="Belum ada jadwal"
            text="Klik “Tambah jadwal”, atau minta AI Assistant: “Jadwalkan interview Tokopedia hari Kamis jam 10”."
          />
        </div>
      ) : (
        sections
          .filter((s) => s.items.length > 0)
          .map((s) => (
            <div key={s.title} className="card">
              <h2 className="mb-1 font-bold">
                {s.title} <span className="text-sm font-medium text-stone-400">{s.items.length}</span>
              </h2>
              <AgendaList items={s.items} />
            </div>
          ))
      )}

      {user && (
        <ReminderSettings
          userId={user.id}
          email={user.email ?? ""}
          initial={(remRes.data as ReminderRow | null) ?? null}
          tableReady={!remRes.error}
          emailReady={Boolean(process.env.RESEND_API_KEY)}
          schedulerReady={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
        />
      )}
    </div>
  );
}
