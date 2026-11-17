import { embed, generateText } from "ai";
import { chatModel, embeddingModel } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let jobDescription = "";
  let kind = "match";
  try {
    const body = await req.json();
    jobDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
    kind = body.kind === "cover" ? "cover" : "match";
  } catch {
    return Response.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  if (jobDescription.length < 30) {
    return Response.json({ error: "Tempel deskripsi lowongan terlebih dahulu (minimal 30 karakter)." }, { status: 400 });
  }
  jobDescription = jobDescription.slice(0, 6000);

  try {
    // RAG: cari bagian CV yang paling relevan dengan lowongan
    const { embedding } = await embed({ model: embeddingModel(), value: jobDescription.slice(0, 3000) });
    const { data: matches, error } = await supabase.rpc("match_cv_chunks", {
      query_embedding: JSON.stringify(embedding),
      match_count: 6,
    });
    if (error) throw new Error(error.message);
    if (!matches || matches.length === 0) {
      return Response.json({ error: "Upload CV dulu sebelum menggunakan fitur ini." }, { status: 400 });
    }
    const cvContext = matches.map((m: { content: string }) => m.content).join("\n---\n");

    const task =
      kind === "cover"
        ? "Tulis cover letter singkat (maks 250 kata) dalam Bahasa Indonesia formal yang menonjolkan pengalaman dari CV yang paling relevan dengan lowongan. Jangan mengarang pengalaman yang tidak ada di CV."
        : "Analisis kecocokan CV dengan lowongan. Format: 1) Skor kecocokan 0-100 beserta alasannya, 2) Kekuatan yang cocok, 3) Gap / hal yang belum ada di CV, 4) Tiga saran perbaikan konkret. Gunakan Bahasa Indonesia dan hanya berdasarkan isi CV.";

    const { text } = await generateText({
      model: chatModel(),
      system: "Kamu rekruter dan career coach yang jujur dan spesifik.",
      prompt: `${task}\n\n=== BAGIAN CV RELEVAN ===\n${cvContext}\n\n=== DESKRIPSI LOWONGAN ===\n${jobDescription}`,
    });
    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI error" }, { status: 500 });
  }
}
