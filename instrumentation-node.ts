import { startReminderScheduler } from "@/lib/reminder-scheduler";

export function registerNode() {
  // di Vercel dipakai Cron (vercel.json), bukan timer di dalam proses
  if (process.env.VERCEL || process.env.DISABLE_REMINDER_SCHEDULER === "1") return;

  const g = globalThis as { __jobtrackReminderTimer?: unknown };
  if (g.__jobtrackReminderTimer) return; // cegah timer ganda saat hot reload
  g.__jobtrackReminderTimer = startReminderScheduler();
}
