export const STATUSES = ["wishlist", "applied", "interview", "offer", "rejected"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export const STATUS_STYLE: Record<Status, string> = {
  wishlist: "bg-stone-200 text-stone-700",
  applied: "bg-sky-100 text-sky-800",
  interview: "bg-amber-100 text-amber-800",
  offer: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

export const STATUS_BAR: Record<Status, string> = {
  wishlist: "bg-stone-400",
  applied: "bg-sky-500",
  interview: "bg-amber-500",
  offer: "bg-emerald-600",
  rejected: "bg-rose-500",
};

export interface Application {
  id: string;
  company: string;
  position: string;
  status: Status;
  location: string | null;
  job_url: string | null;
  salary: string | null;
  notes: string | null;
  applied_date: string | null;
  created_at: string;
  // detail lamaran (kolom ini kosong/undefined bila migrasi detail belum dijalankan)
  job_description?: string | null;
  match_score?: number | null;
  match_analysis?: string | null;
  interview_prep?: string | null;
  cover_letter?: string | null;
  ai_updated?: Partial<Record<"match" | "interview" | "cover", string>> | null;
}

/**
 * Kolom untuk tampilan daftar/papan/dashboard. Sengaja TANPA kolom teks besar (deskripsi lowongan,
 * analisis, persiapan interview, cover letter) agar halaman daftar tetap ringan; kolom itu hanya dimuat
 * di halaman detail satu lamaran.
 */
export const APPLICATION_LIST_COLUMNS =
  "id, company, position, status, location, job_url, salary, notes, applied_date, created_at, match_score";
export const APPLICATION_DASHBOARD_COLUMNS = "id, company, position, status, applied_date, created_at";
