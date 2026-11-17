import { createClient } from "@supabase/supabase-js";

/**
 * Klien Supabase dengan service role: MELEWATI RLS. Hanya untuk kode server (penjadwal pengingat).
 * Jangan pernah mengimpor ini dari komponen klien dan jangan memberi awalan NEXT_PUBLIC_ pada kuncinya.
 */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
