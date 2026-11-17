import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Menukar tautan dari email Supabase (reset password, konfirmasi) menjadi sesi login.
 * Mendukung dua bentuk tautan:
 *  - PKCE (bawaan):   /auth/callback?code=...&next=/reset-password
 *  - token_hash:      /auth/callback?token_hash=...&type=recovery&next=/reset-password
 *    (untuk template email yang diubah, berguna bila tautan dibuka di perangkat/browser lain)
 */

/** Hanya izinkan tujuan di dalam aplikasi ini (cegah open redirect). */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/dashboard";
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const failure = NextResponse.redirect(`${origin}${next === "/reset-password" ? "/forgot-password" : "/login"}?error=link`);

  // Supabase menandai tautan kedaluwarsa/tidak valid lewat parameter error
  if (searchParams.get("error") || searchParams.get("error_code")) return failure;

  const supabase = createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }
  return ok ? NextResponse.redirect(`${origin}${next}`) : failure;
}
