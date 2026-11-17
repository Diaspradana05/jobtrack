"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, X } from "lucide-react";
import AgendaList from "@/components/AgendaList";
import { createClient } from "@/lib/supabase/client";
import { KINDS, KIND_LABEL, nowWib, sortSchedules, type Kind, type Schedule } from "@/lib/schedule";

export type AppOption = { id: string; company: string; position: string };

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Dialog jadwal. Dengan `appId`: menampilkan jadwal lamaran itu + form tambah.
 * Tanpa `appId`: hanya form tambah dengan pilihan lamaran (dipakai di halaman Agenda).
 */
export default function ScheduleDialog({
  apps,
  appId,
  schedules = [],
  onClose,
}: {
  apps: AppOption[];
  appId?: string;
  schedules?: Schedule[];
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const today = nowWib().date;

  const [selectedApp, setSelectedApp] = useState(appId ?? apps[0]?.id ?? "");
  const [kind, setKind] = useState<Kind>("interview");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const current = apps.find((a) => a.id === appId);
  const mine = schedules.filter((s) => s.application_id === appId);
  const ordered = [...mine.filter((s) => !s.done).sort(sortSchedules), ...mine.filter((s) => s.done).sort(sortSchedules)];

  function pickKind(k: Kind) {
    setKind(k);
    // interview biasanya punya jam; deadline & follow-up cukup tanggal
    setTime(k === "interview" ? "09:00" : "");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedApp) return setError("Pilih lamaran terlebih dahulu.");
    if (!date) return setError("Tanggal wajib diisi.");
    setSaving(true);
    setError("");
    const { error } = await supabase.from("schedules").insert({
      application_id: selectedApp,
      kind,
      due_date: date,
      due_time: time || null,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      setError(
        /relation .*schedules|does not exist|schema cache/i.test(error.message)
          ? "Tabel jadwal belum dibuat. Jalankan supabase/migration-schedules.sql di Supabase SQL Editor."
          : error.message,
      );
      return;
    }
    setNote("");
    router.refresh();
    if (!appId) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg animate-pop space-y-5 overflow-y-auto rounded-3xl bg-white p-6 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{appId ? "Jadwal & pengingat" : "Tambah jadwal"}</h2>
            {current && (
              <p className="truncate text-sm text-stone-500">
                {current.position} di {current.company}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>

        {appId && (
          <div>
            <AgendaList items={ordered} emptyText="Belum ada jadwal untuk lamaran ini. Tambahkan di bawah." />
          </div>
        )}

        <form onSubmit={save} className="space-y-3 rounded-2xl bg-stone-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <CalendarPlus className="h-4 w-4 text-brand" /> Tambah jadwal
          </p>

          {!appId && (
            <div>
              <label className="mb-1 block text-sm font-medium">Lamaran</label>
              <select className="input" value={selectedApp} onChange={(e) => setSelectedApp(e.target.value)}>
                {apps.length === 0 && <option value="">Belum ada lamaran</option>}
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.position} — {a.company}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => pickKind(k)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  kind === k ? "bg-ink text-white" : "bg-white text-stone-600 hover:bg-stone-100"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Tanggal *</label>
              <input type="date" required className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              <div className="mt-1.5 flex gap-1.5">
                {[
                  ["Besok", 1],
                  ["3 hari", 3],
                  ["1 minggu", 7],
                ].map(([label, n]) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => setDate(addDays(today, Number(n)))}
                    className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Jam (WIB, opsional)</label>
              <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Catatan</label>
            <input
              className="input"
              placeholder={kind === "interview" ? "mis. Interview HR via Google Meet" : kind === "follow_up" ? "mis. Email recruiter" : "mis. Batas pendaftaran"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              {appId ? "Tutup" : "Batal"}
            </button>
            <button className="btn" disabled={saving || !selectedApp}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan jadwal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Tombol "Tambah jadwal" + dialognya, untuk halaman Agenda. */
export function AddScheduleButton({ apps }: { apps: AppOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" /> Tambah jadwal
      </button>
      {open && <ScheduleDialog apps={apps} onClose={() => setOpen(false)} />}
    </>
  );
}
