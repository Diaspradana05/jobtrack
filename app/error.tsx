"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

/** Pembatas error tingkat root (mis. halaman masuk/daftar). Halaman aplikasi punya pembatas sendiri di (app)/error.tsx. */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight">Terjadi kesalahan</h1>
      <p className="max-w-sm text-sm text-stone-500">Halaman gagal dimuat. Coba lagi, dan jika masih terjadi, muat ulang browser.</p>
      <button className="btn" onClick={reset}>
        <RotateCcw className="h-4 w-4" /> Coba lagi
      </button>
    </main>
  );
}
