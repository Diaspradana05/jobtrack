import { runReminders, schedulerEnvMissing } from "@/lib/reminders";

/**
 * Penjadwal lokal: memeriksa tiap 5 menit selama server Next.js berjalan.
 * Bila komputer/server sempat mati, ringkasan hari itu dikirim begitu server menyala kembali (maks. sekali per hari).
 */
export function startReminderScheduler() {
  let warned = false;
  let lastError = "";

  const tick = async () => {
    const missing = schedulerEnvMissing();
    if (missing) {
      if (!warned) console.log(`[pengingat] Email otomatis nonaktif: ${missing}`);
      warned = true;
      return;
    }
    warned = false;
    try {
      const results = await runReminders();
      lastError = "";
      for (const r of results) if (r.status !== "skipped") console.log(`[pengingat] ${r.status}: ${r.detail}`);
    } catch (e) {
      // catat sekali saja per jenis error agar terminal tidak penuh pesan yang sama
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== lastError) console.error("[pengingat]", msg);
      lastError = msg;
    }
  };

  const first = setTimeout(tick, 15_000);
  const timer = setInterval(tick, 5 * 60_000);
  first.unref?.();
  timer.unref?.();
  console.log("[pengingat] Penjadwal email aktif: dicek tiap 5 menit selama server berjalan.");
  return timer;
}
