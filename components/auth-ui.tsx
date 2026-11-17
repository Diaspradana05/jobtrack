"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";

/** Potongan antarmuka yang dipakai bersama oleh halaman masuk, daftar, lupa, dan reset password. */

/** Kekuatan password sederhana: 0-4. */
export function strength(pw: string): number {
  if (!pw) return 0;
  let n = 0;
  if (pw.length >= 6) n++;
  if (pw.length >= 10) n++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) n++;
  return Math.min(4, n);
}
const STRENGTH_LABEL = ["", "Lemah", "Cukup", "Baik", "Kuat"];
const STRENGTH_TONE = ["bg-stone-200", "bg-rose-400", "bg-amber-400", "bg-emerald-400", "bg-emerald-600"];

export function StrengthMeter({ password }: { password: string }) {
  const score = useMemo(() => strength(password), [password]);
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition ${i <= score ? STRENGTH_TONE[score] : "bg-stone-200"}`} />
        ))}
      </div>
      <p className="mt-1 text-xs text-stone-500">
        Kekuatan password: <span className="font-semibold">{STRENGTH_LABEL[score]}</span>
        {score < 3 && " · coba campur huruf besar/kecil, angka, dan simbol"}
      </p>
    </div>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder = "Minimal 6 karakter",
  labelRight,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  labelRight?: React.ReactNode;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
        </label>
        {labelRight}
      </div>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          id={id}
          className="input !py-3 pl-10 pr-11"
          type={show ? "text" : "password"}
          required
          minLength={6}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-stone-400 transition hover:text-ink"
          aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success" | "warning"; children: React.ReactNode }) {
  const tone =
    kind === "error" ? "bg-rose-50 text-rose-700" : kind === "warning" ? "bg-amber-50 text-amber-800" : "bg-brand-soft text-brand-dark";
  const Icon = kind === "success" ? CheckCircle2 : AlertCircle;
  return (
    <p className={`flex items-start gap-2 rounded-xl p-3 text-sm ${tone}`} role={kind === "error" ? "alert" : "status"}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" /> <span>{children}</span>
    </p>
  );
}
