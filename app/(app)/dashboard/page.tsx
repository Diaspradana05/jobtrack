import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, CalendarCheck, CalendarClock, MessageSquare, Plus, Send, Trophy, XCircle } from "lucide-react";
import AgendaList from "@/components/AgendaList";
import BarList from "@/components/BarList";
import CompanyAvatar from "@/components/CompanyAvatar";
import EmptyState from "@/components/EmptyState";
import InsightCard from "@/components/InsightCard";
import StatusBadge from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import { nowWib, pendingSorted, urgency, type Schedule } from "@/lib/schedule";
import { APPLICATION_DASHBOARD_COLUMNS, STATUSES, STATUS_BAR, STATUS_LABEL, type Application } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

/** Sapaan menurut jam WIB. */
function greeting(hour: number): string {
  if (hour < 4) return "Selamat malam";
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function firstName(email: string | undefined): string {
  const local = (email ?? "").split("@")[0].replace(/[\d._-]+$/, "");
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
}

export default async function DashboardPage() {
  const supabase = createClient();
  const [{ data, error }, userRes] = await Promise.all([
    supabase.from("applications").select(APPLICATION_DASHBOARD_COLUMNS).order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);
  if (error) throw new Error(`Gagal memuat dashboard: ${error.message}`);
  const apps = (data ?? []) as Application[];
  const name = firstName(userRes.data.user?.email);

  // agenda: jadwal belum selesai (kosong bila tabel schedules belum dibuat)
  const { data: schData } = await supabase.from("schedules").select("*, applications(company, position)").eq("done", false);
  const agenda = pendingSorted((schData ?? []) as Schedule[]);
  const nowW = nowWib();
  const overdueCount = agenda.filter((s) => urgency(s, nowW) === "overdue").length;
  const todayCount = agenda.filter((s) => urgency(s, nowW) === "today").length;

  const count = (s: string) => apps.filter((a) => a.status === s).length;
  const total = apps.length;
  const submitted = total - count("wishlist");
  const interviewRate = submitted ? Math.round(((count("interview") + count("offer")) / submitted) * 100) : 0;

  // lamaran per minggu (6 minggu terakhir)
  const weeks = Array.from({ length: 6 }, (_, i) => ({ label: i === 0 ? "Minggu ini" : `${i} mgg lalu`, value: 0 }));
  const now = Date.now();
  apps.forEach((a) => {
    const d = new Date(a.applied_date ? `${a.applied_date}T00:00:00` : a.created_at).getTime();
    const idx = Math.floor((now - d) / (7 * 24 * 3600 * 1000));
    if (idx >= 0 && idx < 6) weeks[idx].value++;
  });

  const stats = [
    { label: "Total lamaran", value: total, icon: Send, hint: "Semua lamaran yang tercatat", tone: "bg-brand-soft text-brand" },
    { label: "Interview", value: count("interview"), icon: CalendarCheck, hint: `${interviewRate}% lolos ke tahap interview+`, tone: "bg-amber-100 text-amber-700" },
    { label: "Offer", value: count("offer"), icon: Trophy, hint: "Tawaran kerja/magang yang masuk", tone: "bg-emerald-100 text-emerald-700" },
    { label: "Ditolak", value: count("rejected"), icon: XCircle, hint: "Tetap semangat, terus lamar", tone: "bg-rose-100 text-rose-700" },
  ];

  // kalimat ringkas tentang hal yang perlu perhatian hari ini
  const focus =
    overdueCount > 0
      ? `${overdueCount} jadwal terlambat${todayCount ? ` dan ${todayCount} jatuh tempo hari ini` : ""}. Yuk selesaikan.`
      : todayCount > 0
        ? `${todayCount} jadwal jatuh tempo hari ini.`
        : "Tidak ada jadwal yang mendesak hari ini.";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">
            {greeting(Number(nowW.time.slice(0, 2)))}
            {name ? `, ${name}` : ""} 
          </h1>
          <p className="page-desc">{focus}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/applications" className="btn">
            <Plus className="h-4 w-4" /> Tambah lamaran
          </Link>
          <Link href="/chat" className="btn-ghost">
            <MessageSquare className="h-4 w-4" /> Tanya AI
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, hint, tone }) => (
          <div key={label} className="card card-hover">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-500">{label}</span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-4xl font-extrabold tracking-tight">{value}</p>
            <p className="mt-2 text-sm text-stone-500">{hint}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-brand" /> Agenda mendatang
            {overdueCount > 0 && (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">{overdueCount} terlambat</span>
            )}
          </h2>
          <Link href="/agenda" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            Lihat semua <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <AgendaList
          items={agenda.slice(0, 5)}
          allowDelete={false}
          emptyText="Belum ada jadwal. Tambahkan deadline, interview, atau follow-up di menu Agenda atau lewat AI Assistant."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="section-title mb-4">Lamaran per status</h2>
          <BarList items={STATUSES.map((s) => ({ label: STATUS_LABEL[s], value: count(s), className: STATUS_BAR[s] }))} />
        </div>
        <div className="card">
          <h2 className="section-title mb-4">Lamaran per minggu</h2>
          <BarList items={[...weeks].reverse()} />
        </div>
      </div>

      <InsightCard />

      <div className="card">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="section-title">Lamaran terbaru</h2>
          {apps.length > 0 && (
            <Link href="/applications" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
              Lihat semua <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        {apps.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Belum ada lamaran"
            text="Catat lamaran pertamamu, atau minta AI Assistant mencatatkannya dari screenshot lowongan."
            action={
              <Link href="/applications" className="btn">
                <Plus className="h-4 w-4" /> Tambah lamaran
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-stone-100">
            {apps.slice(0, 5).map((a) => (
              <li key={a.id} className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-stone-50">
                <Link href={`/applications/${a.id}`} className="flex min-w-0 items-center gap-3">
                  <CompanyAvatar name={a.company} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{a.position}</span>
                    <span className="block truncate text-sm text-stone-500">{a.company}</span>
                  </span>
                </Link>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
