"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { Alert } from "@/components/auth-ui";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/utils";

const COOLDOWN = 60;

export default function ForgotPasswordForm({ linkError }: { linkError?: boolean }) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // hitung mundur sebelum boleh kirim ulang (menghindari batas email Supabase)
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading || cooldown > 0) return;
    setLoading(true);
    setError("");
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) setError(authErrorMessage(error.message));
      else {
        setSent(true);
        setCooldown(COOLDOWN);
      }
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan"));
    }
    setLoading(false);
  }

  return (
    <AuthShell>
      {sent ? (
        <div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <MailCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Cek email kamu</h1>
          <p className="mt-2 text-stone-600">
            Jika <span className="font-semibold text-ink">{email.trim()}</span> terdaftar, kami telah mengirim tautan untuk mengatur ulang password.
          </p>
          <ul className="mt-5 space-y-2 rounded-2xl bg-white p-4 text-sm text-stone-600">
            <li>• Periksa juga folder <span className="font-medium">spam</span> atau promosi.</li>
            <li>• Buka tautannya di <span className="font-medium">browser yang sama</span> dengan yang kamu pakai sekarang.</li>
            <li>• Tautan hanya berlaku sebentar. Jika kedaluwarsa, minta yang baru.</li>
          </ul>
          {error && (
            <div className="mt-4">
              <Alert kind="error">{error}</Alert>
            </div>
          )}
          <button className="btn-ghost mt-5 w-full !py-3" onClick={() => submit()} disabled={loading || cooldown > 0}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {cooldown > 0 ? `Kirim ulang dalam ${cooldown} detik` : "Kirim ulang email"}
          </button>
          <button className="mt-3 w-full text-center text-sm text-stone-500 hover:text-brand" onClick={() => setSent(false)}>
            Gunakan email lain
          </button>
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-extrabold tracking-tight">Lupa password?</h1>
          <p className="mt-2 text-stone-500">Masukkan email akunmu. Kami akan mengirim tautan untuk mengatur ulang password.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            {linkError && <Alert kind="warning">Tautan reset sudah kedaluwarsa atau tidak valid. Minta tautan baru di bawah ini.</Alert>}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  id="email"
                  className="input !py-3 pl-10"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kamu@email.com"
                />
              </div>
            </div>
            {error && <Alert kind="error">{error}</Alert>}
            <button className="btn w-full !py-3 text-base" disabled={loading || !email.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Mengirim..." : "Kirim tautan reset"}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
          <ArrowLeft className="h-4 w-4" /> Kembali ke halaman masuk
        </Link>
      </p>
    </AuthShell>
  );
}
