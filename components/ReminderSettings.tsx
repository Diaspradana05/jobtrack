"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Save, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

export interface ReminderRow {
  enabled: boolean;
  send_hour: number;
  lead_days: number;
  last_sent_on: string | null;
  last_attempt_at: string | null;
  last_status: string | null;
}

const HOURS = [5, 6, 7, 8, 9, 10, 12];
const LEADS: [number, string][] = [
  [0, "Hari ini saja"],
  [1, "Sampai besok"],
  [2, "Sampai 2 hari lagi"],
  [3, "Sampai 3 hari lagi"],
  [7, "Sampai 7 hari lagi"],
];

export default function ReminderSettings({
  userId,
  email,
  initial,
  tableReady,
  emailReady,
  schedulerReady,
}: {
  userId: string;
  email: string;
  initial: ReminderRow | null;
  tableReady: boolean;
  emailReady: boolean;
  schedulerReady: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [hour, setHour] = useState(initial?.send_hour ?? 7);
  const [lead, setLead] = useState(initial?.lead_days ?? 1);
  const [saved, setSaved] = useState({ enabled: initial?.enabled ?? false, hour: initial?.send_hour ?? 7, lead: initial?.lead_days ?? 1 });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const dirty = enabled !== saved.enabled || hour !== saved.hour || lead !== saved.lead;

  async function save() {
    setSaving(true);
    setError("");
    setMsg("");
    const { error } = await supabase
      .from("reminder_settings")
      .upsert({ user_id: userId, enabled, send_hour: hour, lead_days: lead }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      setError(
        /relation .*reminder_settings|schema cache|does not exist/i.test(error.message)
          ? "Tabel pengingat belum dibuat. Jalankan supabase/migration-reminders.sql di Supabase SQL Editor."
          : error.message,
      );
      return;
    }
    setSaved({ enabled, hour, lead });
    setMsg(enabled ? "Pengaturan tersimpan. Pengingat email aktif." : "Pengaturan tersimpan. Pengingat email dimatikan.");
    router.refresh();
  }

  async function sendTest() {
    setTesting(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/reminders/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadDays: lead }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mengirim email tes");
      setMsg(`Email tes terkirim ke ${json.to} (${json.counts.total} jadwal di dalamnya). Cek inbox atau folder spam.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
    setTesting(false);
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <Mail className="h-4 w-4 text-brand" /> Pengingat email
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Ringkasan jadwal harian dikirim ke <span className="font-medium text-stone-700">{email}</span>.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Aktifkan pengingat email"
          onClick={() => setEnabled((v) => !v)}
          disabled={!tableReady}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-brand" : "bg-stone-300"} disabled:opacity-50`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      {!tableReady && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
          Tabel pengingat belum dibuat. Jalankan <code className="rounded bg-white px-1">supabase/migration-reminders.sql</code> di Supabase SQL Editor, lalu muat ulang.
        </p>
      )}
      {!emailReady && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
          <code className="rounded bg-white px-1">RESEND_API_KEY</code> belum diisi di <code className="rounded bg-white px-1">.env.local</code>, jadi email belum bisa dikirim.
        </p>
      )}
      {emailReady && !schedulerReady && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
          Email tes sudah bisa dikirim, tetapi pengiriman otomatis butuh <code className="rounded bg-white px-1">SUPABASE_SERVICE_ROLE_KEY</code> di{" "}
          <code className="rounded bg-white px-1">.env.local</code> (lalu restart server).
        </p>
      )}

      <div className={`grid gap-3 sm:grid-cols-2 ${enabled ? "" : "opacity-60"}`}>
        <div>
          <label className="mb-1 block text-sm font-medium">Kirim setiap hari pukul</label>
          <select className="input" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}.00 WIB
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Sertakan jadwal</label>
          <select className="input" value={lead} onChange={(e) => setLead(Number(e.target.value))}>
            {LEADS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-stone-500">
        Jadwal yang terlambat dan belum ditandai selesai selalu ikut. Email hanya dikirim bila ada jadwal, paling banyak sekali sehari. Saat dijalankan di
        komputer (<code>npm run dev</code>), email terkirim sesuai jam pilihanmu selama server menyala. Di server produksi (Vercel paket gratis), ringkasan dikirim sekali sehari sekitar pukul 07.00 WIB.
      </p>

      {initial?.last_status && (
        <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
          Status terakhir: {initial.last_status}
          {initial.last_sent_on ? ` · kirim terakhir ${formatDate(initial.last_sent_on)}` : ""}
        </p>
      )}
      {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {msg && !error && <p className="rounded-2xl bg-brand-soft p-3 text-sm text-brand-dark">{msg}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn-ghost" onClick={sendTest} disabled={testing || !emailReady}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim email tes
        </button>
        <button className="btn" onClick={save} disabled={saving || !dirty || !tableReady}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
        </button>
      </div>
    </div>
  );
}
