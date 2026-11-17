import { AppAIError, friendlyAIError, isTask, runApplicationAI } from "@/lib/application-ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let applicationId = "";
  let task: unknown;
  try {
    const body = await req.json();
    applicationId = typeof body.applicationId === "string" ? body.applicationId : "";
    task = body.task;
  } catch {
    return Response.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  if (!isTask(task)) return Response.json({ error: "Jenis tugas tidak dikenal." }, { status: 400 });
  if (!applicationId) return Response.json({ error: "ID lamaran kosong." }, { status: 400 });

  try {
    const { text, score, generatedAt } = await runApplicationAI(supabase, applicationId, task);
    return Response.json({ text, score, generatedAt });
  } catch (e) {
    if (!(e instanceof AppAIError)) console.error("[application-ai]", e);
    return Response.json({ error: friendlyAIError(e) }, { status: e instanceof AppAIError ? e.status : 500 });
  }
}
