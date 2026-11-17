import { generateText } from "ai";
import { chatModel } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { TZ, todayLocal } from "@/lib/utils";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let request = "";
  try {
    const body = await req.json();
    request = typeof body.request === "string" ? body.request.slice(0, 300) : "";
  } catch {
    /* body kosong tidak apa-apa */
  }

  const { data } = await supabase
    .from("applications")
    .select("company, position, status, applied_date, notes")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!data || data.length === 0) {
    return Response.json({ text: "Belum ada data lamaran. Tambahkan beberapa lamaran dulu." });
  }

  try {
    const { text } = await generateText({
      model: chatModel(),
      system:
        "Kamu analis karier. Berdasarkan data lamaran kerja pengguna, beri 3-4 insight singkat dan 2 saran konkret berikutnya. Gunakan bahasa Indonesia yang santai dan jelas. Jangan mengarang data yang tidak ada.",
      prompt: `Hari ini: ${todayLocal(TZ)}\nData lamaran (JSON): ${JSON.stringify(data)}\nPermintaan khusus: ${request || "tidak ada"}`,
    });
    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI error" }, { status: 500 });
  }
}
