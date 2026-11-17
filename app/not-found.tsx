import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Compass className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="max-w-sm text-stone-500">Alamat yang kamu buka tidak ada, atau lamaran tersebut sudah dihapus.</p>
      <Link href="/dashboard" className="btn">
        Kembali ke Dashboard
      </Link>
    </main>
  );
}
