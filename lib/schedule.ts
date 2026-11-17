export const SCHEDULE_TZ = "Asia/Jakarta";

export const KINDS = ["deadline", "interview", "follow_up"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABEL: Record<Kind, string> = {
  deadline: "Deadline lamaran",
  interview: "Interview",
  follow_up: "Follow-up",
};

export const KIND_SHORT: Record<Kind, string> = {
  deadline: "Deadline",
  interview: "Interview",
  follow_up: "Follow-up",
};

/** Warna ikon per jenis jadwal. */
export const KIND_TONE: Record<Kind, string> = {
  deadline: "bg-rose-50 text-rose-600",
  interview: "bg-amber-50 text-amber-600",
  follow_up: "bg-sky-50 text-sky-600",
};

export interface Schedule {
  id: string;
  application_id: string;
  kind: Kind;
  due_date: string; // YYYY-MM-DD
  due_time: string | null; // HH:MM[:SS] (WIB) atau null
  note: string | null;
  done: boolean;
  created_at: string;
  applications?: { company: string; position: string } | null;
}

export type Urgency = "done" | "overdue" | "today" | "soon" | "later";

export const URGENCY_STYLE: Record<Urgency, string> = {
  done: "bg-emerald-100 text-emerald-700",
  overdue: "bg-rose-100 text-rose-700",
  today: "bg-amber-100 text-amber-800",
  soon: "bg-sky-100 text-sky-800",
  later: "bg-stone-100 text-stone-600",
};

export type Now = { date: string; time: string };

/** Tanggal & jam sekarang di WIB (tidak bergantung zona waktu perangkat/server). */
export function nowWib(): Now {
  const d = new Date();
  return {
    date: d.toLocaleDateString("en-CA", { timeZone: SCHEDULE_TZ }),
    time: d.toLocaleTimeString("en-GB", { timeZone: SCHEDULE_TZ, hour12: false, hour: "2-digit", minute: "2-digit" }),
  };
}

export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

/** Selisih hari kalender (b - a), keduanya YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function urgency(s: Pick<Schedule, "done" | "due_date" | "due_time">, now: Now = nowWib()): Urgency {
  if (s.done) return "done";
  const t = hhmm(s.due_time);
  if (s.due_date < now.date) return "overdue";
  if (s.due_date === now.date) return t && t < now.time ? "overdue" : "today";
  return daysBetween(now.date, s.due_date) <= 3 ? "soon" : "later";
}

/** "Terlambat 2 hari", "Hari ini 10.00", "Besok", "3 hari lagi", "12 Nov". */
export function relativeLabel(s: Pick<Schedule, "done" | "due_date" | "due_time">, now: Now = nowWib()): string {
  const u = urgency(s, now);
  const t = hhmm(s.due_time).replace(":", ".");
  const diff = daysBetween(now.date, s.due_date);
  if (u === "done") return "Selesai";
  if (u === "overdue") {
    if (diff === 0) return `Terlewat ${t}`;
    return `Terlambat ${Math.abs(diff)} hari`;
  }
  if (diff === 0) return t ? `Hari ini ${t}` : "Hari ini";
  if (diff === 1) return t ? `Besok ${t}` : "Besok";
  if (diff <= 7) return `${diff} hari lagi${t ? ` · ${t}` : ""}`;
  return shortDate(s.due_date);
}

export function shortDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "Kamis, 12 Nov 2026 · 10.00 WIB" */
export function formatDue(s: Pick<Schedule, "due_date" | "due_time">): string {
  const date = new Date(`${s.due_date}T00:00:00Z`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const t = hhmm(s.due_time);
  return t ? `${date} · ${t.replace(":", ".")} WIB` : date;
}

export const sortSchedules = (a: Schedule, b: Schedule) =>
  `${a.due_date} ${hhmm(a.due_time) || "00:00"}`.localeCompare(`${b.due_date} ${hhmm(b.due_time) || "00:00"}`);

/** Jadwal belum selesai, urut dari yang paling dekat/terlambat. */
export const pendingSorted = (list: Schedule[]) => list.filter((s) => !s.done).sort(sortSchedules);
