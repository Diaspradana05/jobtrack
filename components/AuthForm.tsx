"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import AuthShell from "@/components/AuthShell";
import { Alert, PasswordField, StrengthMeter } from "@/components/auth-ui";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/utils";

export default function AuthForm({ mode, notice }: { mode: "login" | "register"; notice?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const isLogin = mode === "login";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(authErrorMessage(error.message));
        else {
          router.push("/dashboard");
          router.refresh();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // setelah klik tautan konfirmasi di email, langsung masuk ke dashboard
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
        });
        if (error) setError(authErrorMessage(error.message));
        else if (data.user && data.user.identities?.length === 0) {
          setError("Email ini sudah terdaftar. Silakan masuk.");
        } else if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setInfo("Akun dibuat. Cek email kamu dan klik tautan konfirmasi, kamu akan langsung masuk ke dashboard.");
        }
      }
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err.message : "Terjadi kesalahan"));
    }
    setLoading(false);
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-extrabold tracking-tight">{isLogin ? "Selamat datang kembali" : "Buat akun barumu"}</h1>
      <p className="mt-2 text-stone-500">{isLogin ? "Masuk untuk melanjutkan melacak lamaran kerjamu." : "Mulai catat lamaran dan biarkan AI membantumu."}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        {notice && <Alert kind="warning">{notice}</Alert>}

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

        <div>
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete={isLogin ? "current-password" : "new-password"}
            labelRight={
              isLogin ? (
                <Link href="/forgot-password" className="text-xs font-semibold text-brand hover:underline">
                  Lupa password?
                </Link>
              ) : undefined
            }
          />
          {!isLogin && <StrengthMeter password={password} />}
        </div>

        {error && <Alert kind="error">{error}</Alert>}
        {info && <Alert kind="success">{info}</Alert>}

        <button className="btn w-full !py-3 text-base" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? (isLogin ? "Masuk..." : "Membuat akun...") : isLogin ? "Masuk" : "Daftar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-600">
        {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
        <Link href={isLogin ? "/register" : "/login"} className="font-semibold text-brand hover:underline">
          {isLogin ? "Daftar gratis" : "Masuk"}
        </Link>
      </p>
    </AuthShell>
  );
}
