/** Tipe & helper simulasi interview yang aman dipakai di server maupun browser (tanpa import server). */

export const MODES = ["mixed", "hr", "technical"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABEL: Record<Mode, string> = {
  mixed: "Campuran (HR + teknis)",
  hr: "HR / perilaku",
  technical: "Teknis / sesuai peran",
};

export const QUESTION_COUNTS = [3, 5, 7] as const;

export interface Turn {
  q: string;
  isFollowUp?: boolean;
  a?: string;
  score?: number;
  good?: string[];
  improve?: string[];
  sample?: string;
}

export interface Report {
  summary: string;
  strengths: string[];
  toPractice: string[];
  nextSteps: string[];
}

export interface InterviewSession {
  id: string;
  application_id: string;
  mode: Mode;
  total_questions: number;
  status: "active" | "finished";
  turns: Turn[];
  report: Report | null;
  avg_score: number | null;
  created_at: string;
  finished_at: string | null;
}

export const isGraded = (t: Turn) => t.a !== undefined && t.score !== undefined;
export const gradedTurns = (s: Pick<InterviewSession, "turns">) => s.turns.filter(isGraded);

export function avgOf(turns: Turn[]): number | null {
  const g = turns.filter(isGraded);
  if (g.length === 0) return null;
  return Math.round((g.reduce((n, t) => n + (t.score ?? 0), 0) / g.length) * 10) / 10;
}

/** Warna lencana skor 1-10. */
export const scoreTone = (n: number) =>
  n >= 7 ? "bg-emerald-100 text-emerald-800" : n >= 5 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";

export const scoreWord = (n: number) =>
  n >= 8.5 ? "Sangat kuat" : n >= 7 ? "Baik" : n >= 5 ? "Cukup, perlu diasah" : "Perlu banyak latihan";

/** Rapor dalam markdown (untuk diunduh sebagai PDF/Word). */
export function reportMarkdown(ctx: { position: string; company: string }, s: InterviewSession): string {
  const date = new Date(s.finished_at ?? s.created_at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const bullets = (a: string[]) => a.map((x) => `- ${x}`).join("\n");
  const lines: string[] = [
    `# Rapor Simulasi Interview`,
    `**${ctx.position}** di **${ctx.company}** · ${date} · ${MODE_LABEL[s.mode]}`,
    s.avg_score != null ? `**Skor rata-rata: ${s.avg_score}/10** (${scoreWord(s.avg_score)})` : "",
  ];
  if (s.report) {
    lines.push("## Ringkasan", s.report.summary);
    if (s.report.strengths.length) lines.push("## Kekuatan", bullets(s.report.strengths));
    if (s.report.toPractice.length) lines.push("## Perlu dilatih", bullets(s.report.toPractice));
    if (s.report.nextSteps.length) lines.push("## Langkah berikutnya", bullets(s.report.nextSteps));
  }
  lines.push("## Detail jawaban");
  gradedTurns(s).forEach((t, i) => {
    lines.push(`### ${i + 1}. ${t.q}`, `**Jawaban Anda:** ${t.a}`, `**Skor:** ${t.score}/10`);
    if (t.good?.length) lines.push("**Yang sudah baik:**", bullets(t.good));
    if (t.improve?.length) lines.push("**Yang perlu diperbaiki:**", bullets(t.improve));
    if (t.sample) lines.push(`**Contoh jawaban yang lebih kuat:** ${t.sample}`);
  });
  return lines.filter((l) => l !== "").join("\n\n");
}

/** Ubah baris database menjadi objek sesi untuk klien (tanpa kolom `context`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToSession(row: any): InterviewSession {
  return {
    id: row.id,
    application_id: row.application_id,
    mode: row.mode,
    total_questions: row.total_questions,
    status: row.status,
    turns: Array.isArray(row.turns) ? row.turns : [],
    report: row.report ?? null,
    avg_score: row.avg_score != null ? Number(row.avg_score) : null,
    created_at: row.created_at,
    finished_at: row.finished_at ?? null,
  };
}
