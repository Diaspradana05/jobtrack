"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, CalendarDays, FileText, LayoutDashboard, ListChecks, LogOut, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "Dashboard", short: "Beranda", icon: LayoutDashboard },
  { href: "/applications", label: "Applications", short: "Lamaran", icon: ListChecks },
  { href: "/agenda", label: "Agenda", short: "Agenda", icon: CalendarDays },
  { href: "/chat", label: "AI Assistant", short: "AI", icon: MessageSquare },
  { href: "/cv", label: "CV & Match", short: "CV", icon: FileText },
];

/** Nama tampilan dari email: bagian sebelum @, tanpa angka/pemisah di ujung, huruf pertama kapital. */
function displayName(email: string): string {
  const local = email.split("@")[0]?.replace(/[\d._-]+$/, "") || email.split("@")[0] || "Kamu";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function Avatar({ email, size = "md" }: { email: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white ${size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"}`}
      aria-hidden
    >
      {(email.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

export default function Sidebar({ email, agendaCount = 0 }: { email: string; agendaCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* ===== Desktop: sidebar kiri ===== */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-stone-200 bg-white/70 p-5 backdrop-blur md:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-brand">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
            <Briefcase className="h-[18px] w-[18px]" />
          </span>
          JobTrack
        </Link>

        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-stone-400">Menu</p>
        <nav className="flex flex-col gap-1" aria-label="Navigasi utama">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-brand text-white shadow-sm" : "text-stone-600 hover:bg-stone-100 hover:text-ink"
                }`}
              >
                <Icon className={`h-4 w-4 transition ${active ? "" : "text-stone-400 group-hover:text-brand"}`} /> {label}
                {href === "/agenda" && agendaCount > 0 && (
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${active ? "bg-white text-brand" : "bg-rose-100 text-rose-700"}`}
                    title="Jadwal terlambat atau jatuh tempo hari ini"
                  >
                    {agendaCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-stone-200 bg-white p-3 shadow-soft">
          <div className="flex items-center gap-3">
            <Avatar email={email} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{displayName(email)}</p>
              <p className="truncate text-xs text-stone-500" title={email}>
                {email}
              </p>
            </div>
          </div>
          <button onClick={signOut} className="btn-ghost mt-3 w-full !py-1.5">
            <LogOut className="h-4 w-4" /> Keluar
          </button>
        </div>
      </aside>

      {/* ===== Ponsel: bilah atas ===== */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-paper/85 px-4 py-2.5 backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-brand">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <Briefcase className="h-4 w-4" />
          </span>
          JobTrack
        </Link>
        <div className="flex items-center gap-2">
          <Avatar email={email} size="sm" />
          <button onClick={signOut} className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-ink" aria-label="Keluar">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ===== Ponsel: navigasi bawah ===== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Navigasi utama"
      >
        {links.map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition ${active ? "text-brand" : "text-stone-500"}`}
            >
              {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand" />}
              <span className="relative">
                <Icon className="h-5 w-5" />
                {href === "/agenda" && agendaCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {agendaCount}
                  </span>
                )}
              </span>
              {short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
