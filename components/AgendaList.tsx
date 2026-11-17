"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Hourglass, Loader2, Mail, Trash2, Users, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  KIND_SHORT,
  KIND_TONE,
  URGENCY_STYLE,
  formatDue,
  nowWib,
  relativeLabel,
  urgency,
  type Kind,
  type Schedule,
} from "@/lib/schedule";

export const KIND_ICON: Record<Kind, LucideIcon> = {
  deadline: Hourglass,
  interview: Users,
  follow_up: Mail,
};

/** Daftar jadwal dengan tombol selesai/hapus. Dipakai di Dashboard, halaman Agenda, dan dialog jadwal. */
export default function AgendaList({
  items,
  emptyText = "Belum ada jadwal.",
  allowDelete = true,
}: {
  items: Schedule[];
  emptyText?: string;
  allowDelete?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const now = nowWib();

  async function toggle(s: Schedule) {
    setBusy(s.id);
    setError("");
    const { error } = await supabase.from("schedules").update({ done: !s.done }).eq("id", s.id);
    setBusy(null);
    if (error) return setError(`Gagal memperbarui jadwal: ${error.message}`);
    router.refresh();
  }

  async function remove(s: Schedule) {
    if (!confirm("Hapus jadwal ini?")) return;
    setBusy(s.id);
    setError("");
    const { error } = await supabase.from("schedules").delete().eq("id", s.id);
    setBusy(null);
    if (error) return setError(`Gagal menghapus jadwal: ${error.message}`);
    router.refresh();
  }

  if (items.length === 0) return <p className="text-sm text-stone-500">{emptyText}</p>;

  return (
    <div>
      {error && <p className="mb-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <ul className="divide-y divide-stone-100">
        {items.map((s) => {
          const Icon = KIND_ICON[s.kind];
          const u = urgency(s, now);
          const app = s.applications;
          return (
            <li key={s.id} className={`flex items-center gap-3 py-3 ${s.done ? "opacity-60" : ""}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${KIND_TONE[s.kind]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${s.done ? "line-through" : ""}`}>
                  {KIND_SHORT[s.kind]}
                  {app && (
                    <Link href={`/applications/${s.application_id}`} className="font-medium text-stone-600 hover:text-brand hover:underline">
                      {" "}
                      · {app.position} di {app.company}
                    </Link>
                  )}
                </p>
                <p className="truncate text-xs text-stone-500">
                  {formatDue(s)}
                  {s.note ? ` · ${s.note}` : ""}
                </p>
              </div>
              <span
                suppressHydrationWarning
                className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline ${URGENCY_STYLE[u]}`}
              >
                {relativeLabel(s, now)}
              </span>
              <div className="flex shrink-0 items-center">
                <button
                  onClick={() => toggle(s)}
                  disabled={busy === s.id}
                  className={`rounded-full p-2 transition ${
                    s.done ? "bg-emerald-100 text-emerald-700" : "text-stone-400 hover:bg-emerald-50 hover:text-emerald-700"
                  }`}
                  aria-label={s.done ? "Tandai belum selesai" : "Tandai selesai"}
                  title={s.done ? "Tandai belum selesai" : "Tandai selesai"}
                >
                  {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                {allowDelete && (
                  <button
                    onClick={() => remove(s)}
                    disabled={busy === s.id}
                    className="p-2 text-stone-400 hover:text-rose-600"
                    aria-label="Hapus jadwal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
