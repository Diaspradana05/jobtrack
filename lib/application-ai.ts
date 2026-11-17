import { embed, generateText } from "ai";
import { chatModel, embeddingModel, msgOf } from "@/lib/ai";
import type { createClient } from "@/lib/supabase/server";

/** Logika bersama: halaman detail lamaran (/api/application-ai) dan AI agent di chat memakai ini. */

type Db = ReturnType<typeof createClient>;

export type Task = "match" | "interview" | "cover";
export const TASK_COLUMN: Record<Task, string> = { match: "match_analysis", interview: "interview_prep", cover: "cover_letter" };
export const TASK_LABEL: Record<Task, string> = { match: "Analisis kecocokan", interview: "Persiapan interview", cover: "Cover letter" };
export const isTask = (v: unknown): v is Task => typeof v === "string" && v in TASK_COLUMN;

/** Error dengan pesan yang aman dan berguna untuk ditampilkan ke pengguna. */
export class AppAIError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const SYSTEM =
  "Kamu rekruter dan career coach yang jujur, spesifik, dan praktis. Jawab dalam Bahasa Indonesia. " +
  "Hanya gunakan fakta yang ada di bagian CV yang diberikan; jangan mengarang pengalaman, angka, atau gelar. " +
  "Format keluaran: markdown sederhana (judul '## ', bullet '- ', **tebal**). Jangan pakai tabel, HTML, atau emoji.";

function taskPrompt(task: Task, ctx: { company: string; position: string; location: string | null; notes: string | null }) {
  const head = `Lowongan: ${ctx.position} di ${ctx.company}${ctx.location ? ` (${ctx.location})` : ""}.${
    ctx.notes ? `\nCatatan pelamar: ${ctx.notes}` : ""
  }`;

  if (task === "match") {
    return `${head}

Analisis kecocokan CV dengan lowongan ini.
BARIS PERTAMA jawaban harus persis: SKOR: <angka 0-100>
Lalu tulis dengan bagian berikut:
## Ringkasan
Dua kalimat tentang seberapa cocok pelamar dan alasannya.
## Kekuatan yang cocok
Poin-poin yang cocok antara CV dan lowongan (sebut bukti dari CV).
## Gap yang perlu ditutup
Syarat lowongan yang belum terlihat di CV.
## Saran perbaikan CV
Tiga saran konkret dan bisa langsung dikerjakan.`;
  }

  if (task === "interview") {
    return `${head}

Susun persiapan interview untuk lowongan ini berdasarkan isi lowongan dan CV pelamar. Gunakan bagian berikut:
## Yang kemungkinan dinilai
Dua-tiga kalimat tentang hal yang akan dicari pewawancara untuk peran ini.
## Pertanyaan perilaku (HR)
Lima pertanyaan. Untuk tiap pertanyaan tulis: **nomor dan pertanyaan**, lalu "Saran jawaban:" dengan kerangka STAR yang memakai pengalaman NYATA dari CV (sebut proyek/kegiatan tertentu). Jika CV tidak punya contoh yang cocok, tulis apa yang sebaiknya disiapkan pelamar.
## Pertanyaan teknis / sesuai peran
Lima pertanyaan yang relevan dengan syarat lowongan, masing-masing dengan poin inti jawaban yang baik.
## Pertanyaan seputar CV
Tiga hal di CV yang kemungkinan digali pewawancara (termasuk celah atau kelemahan), beserta cara menjawabnya dengan jujur.
## Pertanyaan untuk ditanyakan ke pewawancara
Tiga pertanyaan cerdas tentang peran, tim, atau proses seleksi.
## Checklist sebelum hari H
Lima poin persiapan singkat.`;
  }

  return `${head}

Tulis cover letter dalam Bahasa Indonesia formal, maksimal 250 kata, dengan struktur: salam pembuka ("Yth. Tim Rekrutmen ${ctx.company},"), paragraf pembuka yang menyebut posisi, satu-dua paragraf yang menonjolkan pengalaman dari CV yang paling relevan dengan lowongan, paragraf penutup dengan ajakan tindak lanjut, dan salam penutup. Data pribadi yang tidak ada di CV tulis sebagai placeholder dalam kurung siku, misalnya [Nama Lengkap]. Tulis hanya isi surat, tanpa komentar tambahan.`;
}

/** Ubah error teknis (AI/DB) menjadi pesan ramah. */
export function friendlyAIError(e: unknown): string {
  if (e instanceof AppAIError) return e.message;
  const m = msgOf(e);
  if (/high demand|overload|unavailable|503|Semua model gagal/i.test(m))
    return "Server AI sedang sibuk. Tunggu sekitar 30 detik lalu coba lagi.";
  if (/quota|rate limit|429|exhausted/i.test(m)) return "Kuota AI sedang habis. Tunggu sebentar lalu coba lagi.";
  if (/No object generated|did not match schema|Type validation|JSON/i.test(m))
    return "AI belum berhasil menyusun jawaban terstruktur. Coba kirim lagi.";
  if (/dimension/i.test(m)) return "Dimensi embedding tidak cocok dengan database. Cek EMBEDDING_MODEL dan schema.sql.";
  if (/column .* does not exist|schema cache/i.test(m))
    return "Kolom detail lamaran belum ada. Jalankan supabase/migration-application-detail.sql di Supabase SQL Editor.";
  return m;
}

/** Ambil potongan CV yang paling relevan dengan teks (RAG). Melempar AppAIError bila CV belum diupload. */
export async function cvContextFor(supabase: Db, text: string, count = 8): Promise<string> {
  const { embedding } = await embed({ model: embeddingModel(), value: text.slice(0, 3000) });
  const { data: matches, error } = await supabase.rpc("match_cv_chunks", {
    query_embedding: JSON.stringify(embedding),
    match_count: count,
  });
  if (error) throw new Error(error.message);
  if (!matches || matches.length === 0) {
    throw new AppAIError("Upload CV dulu di menu CV & Match sebelum menggunakan fitur ini.");
  }
  return matches.map((m: { content: string }) => m.content).join("\n---\n");
}

export interface AppAIResult {
  text: string;
  score: number | null;
  generatedAt: string;
  application: { id: string; company: string; position: string };
}

/**
 * Membuat hasil AI (kecocokan / interview / cover letter) untuk satu lamaran, lalu menyimpannya.
 * `opts.jobDescription`: bila diisi (min. 30 karakter) disimpan sebagai deskripsi lowongan lebih dulu.
 */
export async function runApplicationAI(
  supabase: Db,
  applicationId: string,
  task: Task,
  opts: { jobDescription?: string | null } = {},
): Promise<AppAIResult> {
  // RLS memastikan hanya lamaran milik pengguna yang bisa dibaca
  const { data: app, error: appErr } = await supabase
    .from("applications")
    .select("id, company, position, location, notes, job_description, ai_updated")
    .eq("id", applicationId)
    .maybeSingle();
  if (appErr) throw new AppAIError(friendlyAIError(appErr), 500);
  if (!app) throw new AppAIError("Lamaran tidak ditemukan.", 404);

  let jd = (app.job_description ?? "").trim();
  const supplied = (opts.jobDescription ?? "").trim();
  if (supplied.length >= 30) {
    const { error } = await supabase.from("applications").update({ job_description: supplied }).eq("id", applicationId);
    if (error) throw new AppAIError(friendlyAIError(error), 500);
    jd = supplied;
  }
  jd = jd.slice(0, 6000);
  if (jd.length < 30) {
    throw new AppAIError(
      `Lamaran ${app.company} belum punya deskripsi lowongan. Tempel teks lowongan (min. 30 karakter), atau isi di halaman detail lamaran.`,
    );
  }

  // RAG: bagian CV yang paling relevan dengan lowongan ini
  const cv = await cvContextFor(supabase, `${app.position} ${app.company}\n${jd}`, 8);

  const { text: raw } = await generateText({
    model: chatModel(),
    system: SYSTEM,
    prompt: `${taskPrompt(task, app)}\n\n=== BAGIAN CV RELEVAN ===\n${cv}\n\n=== DESKRIPSI LOWONGAN ===\n${jd}`,
  });

  let text = raw.trim();
  let score: number | null = null;
  if (task === "match") {
    const m = /^\s*\**SKOR\**\s*[:=]\s*(\d{1,3})[^\n]*\n?/i.exec(text);
    if (m) {
      score = Math.max(0, Math.min(100, Number(m[1])));
      text = text.slice(m[0].length).trim();
    }
  }
  if (!text) throw new AppAIError("AI tidak menghasilkan teks. Coba lagi.", 502);

  const generatedAt = new Date().toISOString();
  const { error: saveErr } = await supabase
    .from("applications")
    .update({
      [TASK_COLUMN[task]]: text,
      ...(task === "match" ? { match_score: score } : {}),
      ai_updated: { ...(app.ai_updated ?? {}), [task]: generatedAt },
    })
    .eq("id", applicationId);
  if (saveErr) throw new Error(saveErr.message);

  return { text, score, generatedAt, application: { id: app.id, company: app.company, position: app.position } };
}
