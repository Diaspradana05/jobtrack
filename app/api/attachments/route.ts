import { generateText } from "ai";
import { geminiModel, msgOf } from "@/lib/ai";
import { MAX_DOC_BYTES, MAX_DOC_CHARS } from "@/lib/attachments";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_SHEETS = 5;
const MAX_ROWS = 300;

function friendly(e: unknown): string {
  const m = msgOf(e);
  if (/high demand|overload|unavailable|503|Semua model gagal/i.test(m)) return "Server AI sedang sibuk saat membaca PDF. Tunggu sekitar 30 detik lalu coba lagi.";
  if (/quota|rate limit|429|exhausted/i.test(m)) return "Kuota AI sedang habis. Tunggu sebentar lalu coba lagi.";
  return m.slice(0, 300);
}

/** Ekstrak teks dari lampiran chat (PDF, Word, Excel/CSV, teks). Gambar tidak lewat sini: dikirim langsung ke model. */
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
    if (file.size > MAX_DOC_BYTES) return Response.json({ error: "Ukuran file maksimal 4 MB" }, { status: 400 });

    const name = file.name;
    const ext = (name.split(".").pop() ?? "").toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (ext === "pdf") {
      // PDF dibaca Gemini secara multimodal (sama seperti upload CV)
      const res = await generateText({
        model: geminiModel(),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transkripsikan seluruh isi dokumen ini menjadi teks polos. Pertahankan urutan, judul, daftar, dan tabel sederhana. Jangan menambah komentar atau ringkasan.",
              },
              { type: "file", data: buffer, mimeType: "application/pdf" },
            ],
          },
        ],
      });
      text = res.text;
    } else if (ext === "docx") {
      // dimuat saat dibutuhkan; diketik longgar agar build tidak bergantung pada tipe library
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mammoth: any = await import("mammoth");
      const extract = mammoth.extractRawText ?? mammoth.default?.extractRawText;
      text = (await extract({ buffer })).value;
    } else if (ext === "xlsx" || ext === "xls") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX: any = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer" });
      const parts: string[] = [];
      for (const sheetName of wb.SheetNames.slice(0, MAX_SHEETS)) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { blankrows: false });
        const lines = csv.split("\n");
        parts.push(`## Sheet: ${sheetName}\n${lines.slice(0, MAX_ROWS).join("\n")}${lines.length > MAX_ROWS ? `\n... (${lines.length - MAX_ROWS} baris lagi tidak ditampilkan)` : ""}`);
      }
      if (wb.SheetNames.length > MAX_SHEETS) parts.push(`(${wb.SheetNames.length - MAX_SHEETS} sheet lain tidak ditampilkan)`);
      text = parts.join("\n\n");
    } else if (["csv", "txt", "md", "json"].includes(ext)) {
      text = new TextDecoder("utf-8").decode(buffer);
    } else if (ext === "doc") {
      return Response.json({ error: "Format .doc lama tidak didukung. Simpan dulu sebagai .docx atau PDF." }, { status: 400 });
    } else {
      return Response.json({ error: "Format harus PDF, Word (.docx), Excel, CSV, atau teks." }, { status: 400 });
    }

    text = text.replace(/\u0000/g, "").trim();
    if (text.length < 1) {
      return Response.json(
        { error: "Tidak ada teks yang terbaca. Jika ini PDF hasil scan, kirim sebagai gambar (screenshot) saja." },
        { status: 400 },
      );
    }
    const truncated = text.length > MAX_DOC_CHARS;
    if (truncated) text = `${text.slice(0, MAX_DOC_CHARS)}\n... [isi dipotong karena terlalu panjang]`;

    return Response.json({ name, text, truncated, chars: text.length });
  } catch (e) {
    console.error("[attachments]", e);
    return Response.json({ error: friendly(e) }, { status: 500 });
  }
}
