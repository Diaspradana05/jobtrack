export const TZ = "Asia/Jakarta";

/** Tanggal hari ini format YYYY-MM-DD. Tanpa argumen = zona waktu perangkat (browser). */
export function todayLocal(timeZone?: string): string {
  return new Date().toLocaleDateString(
    "en-CA",
    timeZone ? { timeZone } : undefined,
  );
}

/** "2026-10-30" -> "30 Okt 2026" */
export function formatDate(d?: string | null): string {
  if (!d) return "-";
  const date = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Pastikan link punya protokol agar bisa diklik. */
export function normalizeUrl(u: string): string | null {
  const t = u.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Terjemahkan pesan error Supabase Auth yang umum ke Bahasa Indonesia. */
export function authErrorMessage(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "Email atau password salah.";
  if (m.includes("email not confirmed"))
    return "Email belum dikonfirmasi. Cek inbox, atau matikan 'Confirm email' di Supabase.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Email ini sudah terdaftar. Silakan masuk.";
  if (m.includes("password should be at least"))
    return "Password minimal 6 karakter.";
  if (m.includes("rate limit") || m.includes("for security purposes") || m.includes("too many requests"))
    return "Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi (Supabase membatasi jumlah email per jam).";
  if (m.includes("different from the old password") || m.includes("same as the old"))
    return "Password baru harus berbeda dari password lama.";
  if (m.includes("auth session missing") || m.includes("session_not_found") || m.includes("otp_expired") || m.includes("expired"))
    return "Link sudah kedaluwarsa atau tidak valid. Minta link baru.";
  if (m.includes("weak password") || m.includes("password is too weak"))
    return "Password terlalu lemah. Gunakan kombinasi huruf, angka, dan simbol.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Tidak bisa terhubung ke Supabase. Periksa koneksi internet dan NEXT_PUBLIC_SUPABASE_URL di .env.local.";
  if (m.includes("invalid api key"))
    return "Supabase anon key salah. Periksa NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local.";
  return msg;
}

/** Buat CSV yang aman dibuka di Excel (BOM + escape tanda kutip). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

/** Perkecil gambar (maks 1600px, JPEG) supaya aman dikirim ke API dan hemat token. */
export async function imageToDataUrl(file: File, opts: { maxDim?: number; quality?: number } = {}): Promise<string> {
  const maxDim = opts.maxDim ?? 1600;
  const quality = opts.quality ?? 0.85;
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Gagal membaca file gambar"));
    r.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Gambar tidak bisa dibuka"));
      i.src = raw;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return raw;
  }
}
