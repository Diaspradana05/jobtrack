import { Briefcase, CalendarClock, LayoutDashboard, Mic, Sparkles } from "lucide-react";

const FEATURES = [
  { icon: LayoutDashboard, title: "Papan Kanban & dashboard", text: "Pantau semua lamaran dari wishlist sampai offer dalam satu tampilan." },
  { icon: CalendarClock, title: "Agenda & pengingat email", text: "Deadline, interview, dan follow-up tidak akan terlewat lagi." },
  { icon: Mic, title: "Simulasi interview AI", text: "Latihan menjawab dan dapatkan skor serta umpan balik yang spesifik." },
  { icon: Sparkles, title: "Asisten AI pribadi", text: "Catat lamaran, analisis CV, dan buat dokumen lewat percakapan." },
];

function PreviewCluster() {
  return (
    <div className="relative mx-auto mt-10 h-[210px] w-full max-w-sm select-none" aria-hidden>
      <div className="absolute left-0 top-4 w-[78%] -rotate-3 rounded-2xl bg-white p-4 text-ink shadow-xl">
        <p className="text-sm font-bold">Data Analyst Intern</p>
        <p className="text-xs text-stone-500">Tokopedia · Jakarta</p>
        <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">Interview · Besok 10.00</span>
      </div>
      <div className="absolute right-0 top-[72px] w-[68%] rotate-2 rounded-2xl bg-white p-4 text-ink shadow-xl">
        <p className="text-xs font-semibold text-stone-500">Kecocokan CV</p>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-3xl font-extrabold leading-none text-brand">82</span>
          <span className="pb-0.5 text-xs text-stone-500">/ 100</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full w-[82%] rounded-full bg-brand" />
        </div>
      </div>
      <div className="absolute bottom-0 left-6 w-[62%] -rotate-1 rounded-2xl bg-white/95 p-3.5 text-ink shadow-xl">
        <p className="text-xs font-semibold text-stone-500">Simulasi interview</p>
        <p className="mt-0.5 text-sm font-bold">Skor rata-rata 7.5 / 10</p>
        <span className="mt-1.5 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">▲ 1.2 dari sesi lalu</span>
      </div>
    </div>
  );
}

/** Kerangka dua panel untuk semua halaman autentikasi: panel merek (desktop) + area formulir. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-dark via-brand to-emerald-600 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.14) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-emerald-300/20 blur-3xl" aria-hidden />

        <div className="relative flex items-center gap-2.5 text-2xl font-extrabold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Briefcase className="h-5 w-5" />
          </span>
          JobTrack
        </div>

        <div className="relative">
          <h2 className="max-w-md text-4xl font-extrabold leading-tight">Satu tempat untuk seluruh perjalanan lamaran kerjamu.</h2>
          <p className="mt-3 max-w-md text-emerald-50/90">Lacak lamaran, persiapkan interview, dan biarkan AI membantumu mendapatkan pekerjaan impian.</p>
          <ul className="mt-8 max-w-md space-y-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-emerald-50/80">{text}</p>
                </div>
              </li>
            ))}
          </ul>
          <PreviewCluster />
        </div>

        <p className="relative text-xs text-emerald-50/70">Data lamaranmu hanya bisa diakses oleh akunmu.</p>
      </aside>

      <section className="flex items-center justify-center bg-paper px-6 py-10 sm:px-10">
        <div className="animate-fade-in w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 text-2xl font-extrabold text-brand lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
              <Briefcase className="h-5 w-5" />
            </span>
            JobTrack
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
