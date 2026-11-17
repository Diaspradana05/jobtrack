import { generateText } from "ai";
import { visionModel } from "@/lib/ai";
import { tidyJobText } from "@/lib/jobtext";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Membaca screenshot/foto lowongan dan mengembalikan teksnya (untuk diisi ke kotak deskripsi lowongan).
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let image: unknown;
  try {
    ({ image } = await req.json());
  } catch {
    return Response.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }
  const m = typeof image === "string" ? /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(image) : null;
  if (!m) return Response.json({ error: "Gambar tidak valid" }, { status: 400 });
  if (m[2].length > 5_500_000) return Response.json({ error: "Gambar terlalu besar" }, { status: 413 });

  try {
    const { text } = await generateText({
      model: visionModel(),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Ini gambar lowongan kerja/magang. Salin seluruh isinya sebagai teks biasa yang RAPI dan mudah dibaca, dengan aturan:
1. Baris pertama: judul posisi. Baris berikutnya (jika ada): nama perusahaan dan lokasi, masing-masing satu baris.
2. Kelompokkan isi ke bagian dengan nama jelas yang diakhiri titik dua, misalnya "Tentang Perusahaan:", "Tanggung Jawab:", "Kualifikasi:", "Benefit:", "Cara Melamar:". Pisahkan antarbagian dengan satu baris kosong.
3. Setiap poin ditulis satu per baris diawali "- ". Poin yang sama sekali bukan daftar ditulis sebagai kalimat biasa.
4. Gabungkan kalimat yang terpotong ke baris berikutnya menjadi satu baris utuh. Perbaiki spasi dan huruf kapital yang jelas salah baca.
5. Jangan memakai markdown (**, #, tabel) atau HTML, dan jangan memakai emoji.
6. Jangan mengarang, merangkum, atau menambah informasi yang tidak ada di gambar.
Jika gambar bukan lowongan atau tidak terbaca, jawab persis: TIDAK_TERBACA`,
            },
            { type: "image", image: m[2], mimeType: m[1] },
          ],
        },
      ],
    });
    const out = tidyJobText(text);
    if (!out || out.includes("TIDAK_TERBACA") || out.length < 30) {
      return Response.json({ error: "Teks lowongan tidak terbaca. Coba gambar yang lebih jelas atau tempel teksnya manual." }, { status: 422 });
    }
    return Response.json({ text: out.slice(0, 6000) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI error";
    if (/high demand|overload|unavailable|503|429|quota|exhausted|Semua model gagal/i.test(msg)) {
      return Response.json(
        { error: "Server AI sedang sibuk. Tunggu sekitar 30 detik lalu coba upload lagi, atau tempel teks lowongan secara manual." },
        { status: 503 },
      );
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
