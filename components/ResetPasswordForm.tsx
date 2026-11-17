"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { Alert, PasswordField, StrengthMeter } from "@/components/auth-ui";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/utils";

type Phase = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordForm() {
  const router = useRouter();
  const supabase = createClient();
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // halaman ini hanya berguna bila tautan email sudah ditukar menjadi sesi (lihat /auth/callback)
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setEmail(data.user?.email ?? "");
      setPhase(data.user ? "ready" : "invalid");
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Password minimal 6 karakter.");
    if (password !== confirm) return setError("Konfirmasi password tidak sama.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setError(authErrorMessage(error.message));
      else {
        setPhase("done");
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 1800);
      }
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan"));
    }
    setLoading(false);
  }

  return (
    <AuthShell>
      {phase === "checking" && (
        <div className="flex items-center gap-3 py-10 text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Memeriksa tautan...
        </div>
      )}

      {phase === "invalid" && (
        <div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Tautan tidak valid</h1>
          <p className="mt-2 text-stone-600">
            Tautan reset password ini sudah kedaluwarsa, sudah dipakai, atau dibuka di browser yang berbeda. Minta tautan baru untuk melanjutkan.
          </p>
          <Link href="/forgot-password" className="btn mt-6 w-full !py-3 text-base">
            Minta tautan baru
          </Link>
        </div>
      )}

      {phase === "done" && (
        <div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Password berhasil diubah</h1>
          <p className="mt-2 text-stone-600">Kamu sudah masuk dengan password baru. Mengalihkan ke dashboard...</p>
          <Loader2 className="mt-5 h-5 w-5 animate-spin text-brand" />
        </div>
      )}

      {phase === "ready" && (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Atur password baru</h1>
          <p className="mt-2 text-stone-500">
            {email ? (
              <>
                Buat password baru untuk <span className="font-semibold text-ink">{email}</span>.
              </>
            ) : (
              "Buat password baru untuk akunmu."
            )}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <PasswordField id="password" label="Password baru" value={password} onChange={setPassword} autoComplete="new-password" autoFocus />
              <StrengthMeter password={password} />
            </div>
            <PasswordField id="confirm" label="Ulangi password baru" value={confirm} onChange={setConfirm} autoComplete="new-password" placeholder="Ketik ulang password" />
            {confirm && password !== confirm && <Alert kind="warning">Konfirmasi password belum sama.</Alert>}
            {error && <Alert kind="error">{error}</Alert>}
            <button className="btn w-full !py-3 text-base" disabled={loading || !password || !confirm}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Menyimpan..." : "Simpan password baru"}
            </button>
          </form>
        </>
      )}

      {phase !== "done" && (
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
            <ArrowLeft className="h-4 w-4" /> Kembali ke halaman masuk
          </Link>
        </p>
      )}
    </AuthShell>
  );
}
