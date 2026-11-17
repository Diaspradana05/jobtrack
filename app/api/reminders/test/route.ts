import { ReminderError, sendDigest } from "@/lib/reminders";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Kirim email tes ke pengguna yang sedang login (memakai sesinya, tidak butuh service role). */
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.email) return Response.json({ error: "Akun ini tidak punya alamat email." }, { status: 400 });

  let leadDays = 1;
  try {
    const body = await req.json();
    if (Number.isInteger(body.leadDays) && body.leadDays >= 0 && body.leadDays <= 14) leadDays = body.leadDays;
  } catch {
    /* pakai default */
  }

  try {
    const counts = await sendDigest(supabase, { userId: user.id, email: user.email, leadDays, force: true });
    return Response.json({ ok: true, to: user.email, counts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal mengirim email";
    if (!(e instanceof ReminderError)) console.error("[reminders/test]", e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
