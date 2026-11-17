import { generateText } from "ai";
import { geminiModel, chunkText, embedChunks } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_CHUNKS = 150;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return Response.json({ error: "File tidak ditemukan" }, { status: 400 });
    if (file.size === 0) return Response.json({ error: "File kosong" }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return Response.json({ error: "Ukuran file maksimal 4 MB" }, { status: 400 });

    const name = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    const isText = file.type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md");
    if (!isPdf && !isText) {
      return Response.json({ error: "Format harus PDF, .txt, atau .md (untuk Word, simpan dulu sebagai PDF)." }, { status: 400 });
    }

    // 1. Ambil teks dari CV (PDF dibaca oleh Gemini secara multimodal)
    let text = "";
    if (isPdf) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const res = await generateText({
        model: geminiModel(),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Transkripsikan seluruh isi dokumen CV ini menjadi teks polos. Pertahankan urutan dan jangan menambah komentar." },
              { type: "file", data: buffer, mimeType: "application/pdf" },
            ],
          },
        ],
      });
      text = res.text;
    } else {
      text = await file.text();
    }
    if (text.trim().length < 50) {
      return Response.json({ error: "Isi CV terlalu pendek atau tidak terbaca. Pastikan PDF bukan hasil scan gambar." }, { status: 400 });
    }

    // 2. Chunk + embedding (dibuat dulu sebelum menyentuh data lama)
    const chunks = chunkText(text).slice(0, MAX_CHUNKS);
    const embeddings = await embedChunks(chunks);

    // 3. Simpan CV baru, lalu hapus CV lama (satu CV aktif per user)
    const { data: doc, error: docErr } = await supabase
      .from("cv_documents")
      .insert({ file_name: file.name, content: text })
      .select("id")
      .single();
    if (docErr || !doc) throw new Error(docErr?.message ?? "Gagal menyimpan CV");

    const rows = chunks.map((content, i) => ({
      document_id: doc.id,
      content,
      embedding: JSON.stringify(embeddings[i]),
    }));
    const { error: chunkErr } = await supabase.from("cv_chunks").insert(rows);
    if (chunkErr) {
      await supabase.from("cv_documents").delete().eq("id", doc.id); // batalkan, CV lama tetap aman
      throw new Error(chunkErr.message);
    }
    await supabase.from("cv_documents").delete().neq("id", doc.id);

    return Response.json({ ok: true, fileName: file.name, chunks: chunks.length });
  } catch (e) {
    return Response.json({ error: friendly(e) }, { status: 500 });
  }
}

function friendly(e: unknown) {
  const m = e instanceof Error ? e.message : "Gagal memproses CV";
  if (/dimension|expected \d+ dimensions/i.test(m)) return "Dimensi embedding tidak cocok dengan vector(768) di database. Cek EMBEDDING_MODEL dan schema.sql.";
  if (/quota|429|exhausted/i.test(m)) return "Kuota Gemini sedang habis. Tunggu sebentar lalu coba lagi.";
  if (/relation .* does not exist|schema cache/i.test(m)) return "Tabel belum ada. Jalankan supabase/schema.sql di SQL Editor Supabase.";
  return m;
}
