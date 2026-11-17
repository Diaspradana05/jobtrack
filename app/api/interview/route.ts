import { AppAIError, friendlyAIError } from "@/lib/application-ai";
import { answerInterview, finishInterview, startInterview } from "@/lib/interview-ai";
import { MODES, QUESTION_COUNTS, type Mode } from "@/lib/interview";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }

  try {
    if (body.action === "start") {
      const mode: Mode = MODES.includes(body.mode) ? body.mode : "mixed";
      const total = (QUESTION_COUNTS as readonly number[]).includes(body.total) ? body.total : 5;
      if (typeof body.applicationId !== "string" || !body.applicationId) throw new AppAIError("ID lamaran kosong.");
      return Response.json({ session: await startInterview(supabase, body.applicationId, mode, total) });
    }
    if (body.action === "answer") {
      if (typeof body.sessionId !== "string" || typeof body.answer !== "string") throw new AppAIError("Data jawaban tidak lengkap.");
      return Response.json(await answerInterview(supabase, body.sessionId, body.answer));
    }
    if (body.action === "finish") {
      if (typeof body.sessionId !== "string") throw new AppAIError("ID sesi kosong.");
      return Response.json(await finishInterview(supabase, body.sessionId));
    }
    return Response.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (e) {
    if (!(e instanceof AppAIError)) console.error("[interview]", e);
    return Response.json({ error: friendlyAIError(e) }, { status: e instanceof AppAIError ? e.status : 500 });
  }
}
