/**
 * Helper respons API untuk kode browser.
 * Di Vercel, kegagalan di level platform (body > 4,5 MB, timeout fungsi, dsb.) dibalas dengan teks/HTML,
 * bukan JSON, sehingga `res.json()` langsung melempar "Unexpected token ...". Helper ini mengubahnya
 * menjadi pesan Bahasa Indonesia yang bisa ditindaklanjuti pengguna.
 */

/** Batas aman body permintaan ke fungsi serverless Vercel (batas platform: 4,5 MB). */
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

export function httpErrorMessage(status: number): string {
  if (status === 401) return "Sesi login berakhir. Muat ulang halaman lalu masuk lagi.";
  if (status === 413) return "Data yang dikirim terlalu besar (maksimal sekitar 4 MB). Gunakan file atau gambar yang lebih kecil.";
  if (status === 408 || status === 504) return "Server terlalu lama merespons. Coba lagi sebentar lagi.";
  if (status === 429) return "Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.";
  if (status >= 500) return `Server sedang bermasalah (kode ${status}). Coba lagi sebentar lagi.`;
  return `Permintaan gagal (kode ${status}).`;
}

/**
 * Baca respons sebagai JSON tanpa melempar error parsing.
 * - Respons JSON (ok maupun gagal) dikembalikan apa adanya.
 * - Respons gagal yang bukan JSON dikembalikan sebagai `{ error: pesan ramah }`.
 * - Respons sukses yang bukan JSON melempar Error dengan pesan ramah.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJson(res: Response): Promise<any> {
  const raw = await res.text().catch(() => "");
  try {
    const data = raw ? JSON.parse(raw) : null;
    if (data && typeof data === "object") return data;
  } catch {
    /* bukan JSON */
  }
  if (!res.ok) return { error: httpErrorMessage(res.status) };
  throw new Error("Respons dari server tidak bisa dibaca. Coba lagi.");
}

/** Pesan error ramah untuk kegagalan jaringan (fetch gagal sebelum ada respons). */
export function networkErrorMessage(e: unknown, fallback = "Terjadi kesalahan"): string {
  if (e instanceof TypeError) return "Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.";
  return e instanceof Error ? e.message : fallback;
}
