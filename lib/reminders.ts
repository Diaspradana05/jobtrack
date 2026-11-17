import { timingSafeEqual } from "node:crypto";
import { buildDigest, type Digest } from "@/lib/reminder-digest";
import { adminClient } from "@/lib/supabase/admin";
import { nowWib, type Schedule } from "@/lib/schedule";

/** Pengiriman email pengingat (Resend) + penentuan siapa yang harus dikirimi sekarang. Hanya untuk server. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any; // klien Supabase (user ber-RLS untuk email tes, service role untuk penjadwal)

export interface ReminderSettings {
  user_id: string;
  enabled: boolean;
  send_hour: number;
  lead_days: number;
  last_sent_on: string | null;
  last_attempt_at: string | null;
  last_status: string | null;
}

export interface RunResult {
  userId: string;
  status: "sent" | "skipped" | "error";
  detail: string;
}

export class ReminderError extends Error {}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const RETRY_AFTER_MS = 30 * 60 * 1000; // setelah gagal, tunggu 30 menit sebelum mencoba lagi

/** Pesan jika konfigurasi penjadwal otomatis belum lengkap, atau null bila siap. */
export function schedulerEnvMissing(): string | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return "SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local";
  if (!process.env.RESEND_API_KEY) return "RESEND_API_KEY belum diisi di .env.local";
  return null;
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function sendEmail(to: string, d: Digest): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new ReminderError("RESEND_API_KEY belum diisi di .env.local");
  const from = process.env.REMINDER_FROM || "JobTrack <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: d.subject, html: d.html, text: d.text }),
  });
  if (!res.ok) {
    let msg = "";
    try {
      const j = await res.json();
      msg = j.message || j.error?.message || JSON.stringify(j);
    } catch {
      msg = await res.text().catch(() => "");
    }
    throw new ReminderError(`Resend (${res.status}): ${msg}`.slice(0, 300));
  }
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Susun dan kirim ringkasan untuk satu pengguna.
 * `force`: kirim walau tidak ada jadwal (untuk email tes). Mengembalikan jumlah jadwal yang dikirim, atau null bila dilewati.
 */
export async function sendDigest(
  db: Db,
  p: { userId: string; email: string; leadDays: number; force?: boolean },
): Promise<Digest["counts"] | null> {
  const now = nowWib();
  const { data, error } = await db
    .from("schedules")
    .select("*, applications(company, position)")
    .eq("user_id", p.userId)
    .eq("done", false)
    .lte("due_date", addDays(now.date, p.leadDays))
    .order("due_date")
    .limit(40);
  if (error) throw new ReminderError(`Gagal membaca jadwal: ${error.message}`);

  const digest = buildDigest((data ?? []) as Schedule[], now, { appUrl: appUrl() });
  if (digest.counts.total === 0 && !p.force) return null;
  await sendEmail(p.email, digest);
  return digest.counts;
}

const countsText = (c: Digest["counts"]) =>
  `${c.total} jadwal (${c.overdue} terlambat, ${c.today} hari ini, ${c.upcoming} segera)`;

/**
 * Dipanggil berkala (penjadwal lokal atau cron): kirim ringkasan ke semua pengguna yang mengaktifkan pengingat,
 * paling banyak sekali per hari (WIB) dan hanya setelah jam kirim yang dipilih.
 * `ignoreHour`: abaikan jam kirim. Dipakai cron harian di Vercel (paket Hobby hanya boleh sekali sehari),
 * yang kalau tidak diabaikan tidak akan pernah mengirim ke pengguna dengan jam kirim setelah jam cron.
 */
export async function runReminders(opts: { ignoreHour?: boolean } = {}): Promise<RunResult[]> {
  const admin = adminClient();
  const now = nowWib();
  const hour = Number(now.time.slice(0, 2));

  const { data: rows, error } = await admin.from("reminder_settings").select("*").eq("enabled", true);
  if (error) throw new ReminderError(`Gagal membaca pengaturan pengingat: ${error.message}`);

  const results: RunResult[] = [];
  for (const s of (rows ?? []) as ReminderSettings[]) {
    if (s.last_sent_on === now.date) {
      results.push({ userId: s.user_id, status: "skipped", detail: "sudah terkirim hari ini" });
      continue;
    }
    if (!opts.ignoreHour && hour < s.send_hour) {
      results.push({ userId: s.user_id, status: "skipped", detail: `belum jam ${s.send_hour}:00 WIB` });
      continue;
    }
    if (s.last_status?.startsWith("Gagal") && s.last_attempt_at && Date.now() - Date.parse(s.last_attempt_at) < RETRY_AFTER_MS) {
      results.push({ userId: s.user_id, status: "skipped", detail: "menunggu sebelum mencoba ulang" });
      continue;
    }

    try {
      const { data: u, error: uErr } = await admin.auth.admin.getUserById(s.user_id);
      const email = u?.user?.email;
      if (uErr || !email) throw new ReminderError("Email pengguna tidak ditemukan");

      const counts = await sendDigest(admin, { userId: s.user_id, email, leadDays: s.lead_days });
      if (!counts) {
        results.push({ userId: s.user_id, status: "skipped", detail: "tidak ada jadwal" });
        continue;
      }
      const status = `Terkirim: ${countsText(counts)}`;
      await admin
        .from("reminder_settings")
        .update({ last_sent_on: now.date, last_attempt_at: new Date().toISOString(), last_status: status })
        .eq("user_id", s.user_id);
      results.push({ userId: s.user_id, status: "sent", detail: `${email} - ${countsText(counts)}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin
        .from("reminder_settings")
        .update({ last_attempt_at: new Date().toISOString(), last_status: `Gagal: ${msg}`.slice(0, 300) })
        .eq("user_id", s.user_id);
      results.push({ userId: s.user_id, status: "error", detail: msg });
    }
  }
  return results;
}
