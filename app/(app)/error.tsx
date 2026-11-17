"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-xl font-bold">Terjadi kesalahan</h1>
      <p className="mt-2 text-sm text-stone-500">
        {error.message || "Halaman gagal dimuat."} Biasanya karena schema.sql belum dijalankan di Supabase atau isi .env.local belum benar.
      </p>
      <button className="btn mt-5" onClick={reset}>
        <RotateCcw className="h-4 w-4" /> Coba lagi
      </button>
    </div>
  );
}
