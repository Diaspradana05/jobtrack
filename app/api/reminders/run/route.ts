import { runReminders, safeEqual, schedulerEnvMissing } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Endpoint untuk cron (mis. Vercel Cron, jam 00:00 UTC = 07:00 WIB). Dilindungi CRON_SECRET:
 * kirim header "Authorization: Bearer <CRON_SECRET>". Tidak diperlukan selama mode lokal.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET belum diisi di environment." }, { status: 500 });
  if (!safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const missing = schedulerEnvMissing();
  if (missing) return Response.json({ error: missing }, { status: 500 });

  try {
    // cron di Vercel (paket gratis) hanya berjalan sekali sehari, jadi jam kirim per pengguna diabaikan.
    // Isi REMINDER_CRON_RESPECT_HOUR=1 bila cron dijalankan tiap jam (paket Pro) agar jam kirim dihormati.
    const results = await runReminders({ ignoreHour: process.env.REMINDER_CRON_RESPECT_HOUR !== "1" });
    return Response.json({ ok: true, results });
  } catch (e) {
    console.error("[reminders/run]", e);
    return Response.json({ error: e instanceof Error ? e.message : "Gagal menjalankan pengingat" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
