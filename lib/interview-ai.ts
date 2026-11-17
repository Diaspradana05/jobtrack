import { generateObject } from "ai";
import { z } from "zod";
import { chatModel } from "@/lib/ai";
import { AppAIError, cvContextFor } from "@/lib/application-ai";
import { avgOf, gradedTurns, rowToSession, type InterviewSession, type Mode, type Report, type Turn } from "@/lib/interview";
import type { createClient } from "@/lib/supabase/server";

type Db = ReturnType<typeof createClient>;

interface AppCtx {
  company: string;
  position: string;
  location: string | null;
  notes: string | null;
  job_description: string | null;
}

const MODE_GUIDE: Record<Mode, string> = {
  mixed: "Campurkan pertanyaan perilaku/HR (motivasi, kerja tim, menghadapi masalah) dan pertanyaan teknis/sesuai peran secara bergantian.",
  hr: "Fokus pada pertanyaan perilaku/HR: motivasi, kerja tim, kepemimpinan, menghadapi kegagalan, dan kecocokan budaya kerja.",
  technical: "Fokus pada pertanyaan teknis dan keahlian yang disyaratkan lowongan: konsep, studi kasus singkat, dan pengalaman proyek.",
};

const systemFor = (app: AppCtx) =>
  `Kamu adalah pewawancara profesional yang sedang mewawancarai pelamar untuk posisi ${app.position} di ${app.company}${
    app.location ? ` (${app.location})` : ""
  }. Gunakan Bahasa Indonesia yang sopan tetapi realistis, seperti interview sungguhan (bukan kuis). ` +
  "Nilailah dengan jujur dan tidak murah hati. Jangan mengarang fakta tentang pelamar: hanya gunakan isi CV yang diberikan. Jangan memakai emoji atau tabel.";

const background = (jd: string, cv: string) => `=== DESKRIPSI LOWONGAN ===\n${jd}\n\n=== BAGIAN CV PELAMAR ===\n${cv}`;

const transcript = (turns: Turn[]) =>
  turns
    .filter((t) => t.a !== undefined)
    .map((t, i) => `P${i + 1}${t.isFollowUp ? " (lanjutan)" : ""}: ${t.q}\nJawaban: ${t.a}\nSkor: ${t.score ?? "-"}/10`)
    .join("\n\n");

const clampScore = (n: number) => Math.min(10, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));
const list = (a: unknown, max: number) => (Array.isArray(a) ? a.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : []);

const firstSchema = z.object({ question: z.string().describe("Pertanyaan pertama, 1-3 kalimat") });
const evalSchema = z.object({
  score: z.number().describe("Skor jawaban, bilangan bulat 1 sampai 10"),
  good: z.array(z.string()).describe("1-3 hal yang sudah baik dari jawaban"),
  improve: z.array(z.string()).describe("1-3 hal konkret yang perlu diperbaiki"),
  sample: z.string().describe("Contoh jawaban yang lebih kuat, maksimal 120 kata"),
});
const nextSchema = evalSchema.extend({
  nextQuestion: z.string().describe("Pertanyaan berikutnya, 1-3 kalimat"),
  isFollowUp: z.boolean().describe("true bila ini pertanyaan lanjutan dari topik yang sama"),
});
const reportSchema = z.object({
  summary: z.string().describe("Ringkasan performa 2-3 kalimat"),
  strengths: z.array(z.string()).describe("Tiga kekuatan utama"),
  toPractice: z.array(z.string()).describe("Tiga hal yang perlu dilatih"),
  nextSteps: z.array(z.string()).describe("Tiga langkah latihan berikutnya yang konkret"),
});

const dbError = (m: string) =>
  /relation .*interview_sessions|schema cache|does not exist/i.test(m)
    ? "Tabel simulasi interview belum dibuat. Jalankan supabase/migration-interview.sql di Supabase SQL Editor."
    : m;

async function loadApp(supabase: Db, applicationId: string): Promise<AppCtx & { id: string }> {
  const { data, error } = await supabase
    .from("applications")
    .select("id, company, position, location, notes, job_description")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw new AppAIError(error.message, 500);
  if (!data) throw new AppAIError("Lamaran tidak ditemukan.", 404);
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadRow(supabase: Db, sessionId: string): Promise<any> {
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("*, applications(company, position, location, notes, job_description)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new AppAIError(dbError(error.message), 500);
  if (!data) throw new AppAIError("Sesi tidak ditemukan.", 404);
  return data;
}

/** Mulai sesi baru (atau lanjutkan sesi aktif yang sudah ada untuk lamaran ini). */
export async function startInterview(supabase: Db, applicationId: string, mode: Mode, total: number): Promise<InterviewSession> {
  const { data: existing, error: exErr } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("application_id", applicationId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);
  if (exErr) throw new AppAIError(dbError(exErr.message), 500);
  if (existing && existing.length > 0) return rowToSession(existing[0]);

  const app = await loadApp(supabase, applicationId);
  const jd = (app.job_description ?? "").trim().slice(0, 6000);
  if (jd.length < 30) {
    throw new AppAIError("Isi dan simpan deskripsi lowongan dulu di halaman detail lamaran (min. 30 karakter).");
  }
  const cv = await cvContextFor(supabase, `${app.position} ${app.company}\n${jd}`, 8);

  const { object } = await generateObject({
    model: chatModel(),
    schema: firstSchema,
    system: systemFor(app),
    temperature: 0.7,
    prompt: `${background(jd, cv)}

${MODE_GUIDE[mode]}
Sesi ini terdiri dari ${total} pertanyaan. Ajukan PERTANYAAN PERTAMA saja. ${
      mode === "technical"
        ? "Mulai dengan satu pertanyaan teknis yang relevan dengan syarat lowongan."
        : "Mulai dengan pembuka yang wajar (misalnya perkenalan singkat dan alasan tertarik pada posisi ini), disesuaikan dengan lowongan."
    } Satu pertanyaan saja, 1-3 kalimat, tanpa salam yang panjang.`,
  });
  const q = object.question.trim();
  if (!q) throw new AppAIError("AI belum menghasilkan pertanyaan. Coba lagi.", 502);

  const { data, error } = await supabase
    .from("interview_sessions")
    .insert({ application_id: applicationId, mode, total_questions: total, turns: [{ q }], context: cv.slice(0, 8000) })
    .select("*")
    .single();
  if (error) throw new AppAIError(dbError(error.message), 500);
  return rowToSession(data);
}

async function makeReport(app: AppCtx, turns: Turn[], mode: Mode): Promise<Report> {
  const avg = avgOf(turns);
  const { object } = await generateObject({
    model: chatModel(),
    schema: reportSchema,
    system: systemFor(app),
    temperature: 0.4,
    prompt: `Sesi simulasi interview (${MODE_GUIDE[mode]}) telah selesai. Berikut transkrip beserta skor tiap jawaban (rata-rata ${avg ?? "-"}/10):

${turns
  .filter((t) => t.a !== undefined)
  .map(
    (t, i) =>
      `P${i + 1}: ${t.q}\nJawaban: ${t.a}\nSkor: ${t.score}/10\nPerlu diperbaiki: ${(t.improve ?? []).join("; ")}`,
  )
  .join("\n\n")}

Buat rapor akhir yang jujur, spesifik, dan bisa ditindaklanjuti: ringkasan, tiga kekuatan, tiga hal yang perlu dilatih, dan tiga langkah latihan berikutnya. Rujuk contoh nyata dari jawaban di atas.`,
  });
  return {
    summary: object.summary.trim(),
    strengths: list(object.strengths, 3),
    toPractice: list(object.toPractice, 3),
    nextSteps: list(object.nextSteps, 3),
  };
}

export interface InterviewResult {
  session: InterviewSession;
  /** Pesan bila sebagian langkah gagal tetapi data jawaban sudah tersimpan. */
  warning?: string;
}

async function finalize(supabase: Db, row: any, turns: Turn[]): Promise<InterviewSession> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const report = await makeReport(row.applications, turns, row.mode);
  const { data, error } = await supabase
    .from("interview_sessions")
    .update({ turns, status: "finished", report, avg_score: avgOf(turns), finished_at: new Date().toISOString() })
    .eq("id", row.id)
    .select("*")
    .single();
  if (error) throw new AppAIError(dbError(error.message), 500);
  return rowToSession(data);
}

/** Terima jawaban, nilai, lalu ajukan pertanyaan berikutnya (atau tutup sesi bila ini pertanyaan terakhir). */
export async function answerInterview(supabase: Db, sessionId: string, answer: string): Promise<InterviewResult> {
  const text = answer.trim();
  if (text.length < 5) throw new AppAIError("Jawaban terlalu singkat. Tulis jawaban Anda dengan lebih lengkap.");
  if (text.length > 4000) throw new AppAIError("Jawaban terlalu panjang (maks 4000 karakter).");

  const row = await loadRow(supabase, sessionId);
  if (row.status === "finished") throw new AppAIError("Sesi ini sudah selesai.");
  const turns: Turn[] = Array.isArray(row.turns) ? row.turns : [];
  const cur = turns[turns.length - 1];
  if (!cur || cur.a !== undefined) throw new AppAIError("Tidak ada pertanyaan yang menunggu jawaban.");

  const app: AppCtx = row.applications;
  const jd = (app.job_description ?? "").slice(0, 6000);
  const prior = turns.slice(0, -1);
  const isLast = prior.length + 1 >= row.total_questions;
  const remaining = row.total_questions - (prior.length + 1);

  const common = `${background(jd, row.context ?? "")}

=== RIWAYAT SESI SEBELUMNYA ===
${transcript(prior) || "(belum ada)"}

=== PERTANYAAN SAAT INI ===
${cur.q}

=== JAWABAN PELAMAR ===
${text}

Tugasmu:
1) score: nilai jawaban 1-10 secara jujur. 1-3 = lemah/tidak menjawab; 4-5 = kurang (umum, tanpa bukti); 6-7 = cukup hingga baik; 8-9 = kuat, spesifik, terstruktur, berbukti; 10 = luar biasa. Jangan murah hati.
2) good: 1-3 hal yang sudah baik.
3) improve: 1-3 hal konkret yang perlu diperbaiki (struktur seperti STAR, bukti angka, relevansi dengan lowongan, kedalaman).
4) sample: contoh jawaban yang lebih kuat (maks 120 kata, sudut pandang orang pertama). Pakai fakta dari CV; bila butuh detail yang tidak ada di CV, tulis placeholder dalam kurung siku, misalnya [angka hasil].`;

  const nextPart = isLast
    ? ""
    : `
5) nextQuestion: pertanyaan berikutnya. ${MODE_GUIDE[row.mode as Mode]} Jangan mengulang pertanyaan sebelumnya. Sisa pertanyaan setelah ini: ${remaining}. ${
        cur.isFollowUp
          ? "Pertanyaan saat ini sudah berupa pertanyaan lanjutan, jadi pindah ke topik baru (isFollowUp false)."
          : "Jika jawaban terlalu dangkal atau kurang bukti, ajukan SATU pertanyaan lanjutan untuk menggali topik yang sama (isFollowUp true); selain itu pindah ke topik baru (isFollowUp false)."
      }`;

  const result = isLast
    ? (await generateObject({ model: chatModel(), schema: evalSchema, system: systemFor(app), temperature: 0.3, prompt: common })).object
    : (await generateObject({ model: chatModel(), schema: nextSchema, system: systemFor(app), temperature: 0.4, prompt: common + nextPart })).object;

  const graded: Turn = {
    ...cur,
    a: text,
    score: clampScore(result.score),
    good: list(result.good, 3),
    improve: list(result.improve, 3),
    sample: String(result.sample ?? "").trim(),
  };
  const newTurns = [...prior, graded];

  if (!isLast) {
    const next = result as z.infer<typeof nextSchema>;
    const nq = (next.nextQuestion ?? "").trim();
    if (!nq) throw new AppAIError("AI belum menghasilkan pertanyaan berikutnya. Kirim ulang jawaban Anda.", 502);
    newTurns.push({ q: nq, isFollowUp: !cur.isFollowUp && !!next.isFollowUp });
    const { data, error } = await supabase.from("interview_sessions").update({ turns: newTurns }).eq("id", sessionId).select("*").single();
    if (error) throw new AppAIError(dbError(error.message), 500);
    return { session: rowToSession(data) };
  }

  // pertanyaan terakhir: simpan penilaian dulu, baru buat rapor (supaya jawaban tidak hilang bila rapor gagal)
  const { data: saved, error: saveErr } = await supabase.from("interview_sessions").update({ turns: newTurns }).eq("id", sessionId).select("*").single();
  if (saveErr) throw new AppAIError(dbError(saveErr.message), 500);
  try {
    return { session: await finalize(supabase, row, newTurns) };
  } catch (e) {
    console.error("[interview] rapor gagal", e);
    return { session: rowToSession(saved), warning: "Penilaian tersimpan, tetapi rapor belum berhasil dibuat. Klik “Buat rapor” untuk mencoba lagi." };
  }
}

/** Akhiri sesi sekarang dan buat rapor dari jawaban yang sudah dinilai. */
export async function finishInterview(supabase: Db, sessionId: string): Promise<InterviewResult> {
  const row = await loadRow(supabase, sessionId);
  if (row.status === "finished") return { session: rowToSession(row) };
  const turns: Turn[] = (Array.isArray(row.turns) ? row.turns : []).filter((t: Turn) => t.a !== undefined && t.score !== undefined);
  if (gradedTurns({ turns }).length === 0) throw new AppAIError("Jawab minimal satu pertanyaan sebelum mengakhiri sesi.");
  return { session: await finalize(supabase, row, turns) };
}
