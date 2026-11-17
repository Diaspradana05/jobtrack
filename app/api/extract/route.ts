import { generateObject } from "ai";
import { z } from "zod";
import { geminiModel } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const schema = z.object({
  company: z.string().describe("Nama perusahaan, kosongkan jika tidak terlihat"),
  position: z.string().describe("Judul posisi / lowongan"),
  location: z.string().describe("Lokasi kerja, kosongkan jika tidak ada"),
  salary: z.string().describe("Gaji atau uang saku jika disebut, kosongkan jika tidak ada"),
  notes: z.string().describe("Ringkasan 2-3 kalimat: kualifikasi dan tanggung jawab utama"),
});

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
    const { object } = await generateObject({
      model: geminiModel(),
      schema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Ini screenshot lowongan kerja/magang. Ekstrak informasinya sesuai skema. Jangan mengarang; jika tidak terlihat, isi string kosong.",
            },
            { type: "image", image: m[2], mimeType: m[1] },
          ],
        },
      ],
    });
    return Response.json(object);
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
