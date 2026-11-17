"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, ExternalLink, GripVertical, Pencil, Plus, Sparkles } from "lucide-react";
import { KIND_SHORT, URGENCY_STYLE, relativeLabel, urgency, type Now, type Schedule } from "@/lib/schedule";
import { STATUSES, STATUS_BAR, STATUS_LABEL, type Application, type Status } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const MATCH_TONE = (n: number) =>
  n >= 75 ? "bg-emerald-100 text-emerald-800" : n >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";

interface Props {
  apps: Application[];
  pendingByApp: Map<string, Schedule[]>;
  now: Now;
  onMove: (id: string, status: Status) => void;
  onEdit: (a: Application) => void;
  onSchedule: (id: string) => void;
  onAdd: (status: Status) => void;
}

/** Papan Kanban: seret kartu antar kolom untuk mengubah status (atau pakai tombol panah di kartu). */
export default function KanbanBoard({ apps, pendingByApp, now, onMove, onEdit, onSchedule, onAdd }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  function drop(status: Status, e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setOverCol(null);
    setDragId(null);
    const app = apps.find((a) => a.id === id);
    if (id && app && app.status !== status) onMove(id, status);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STATUSES.map((status, colIndex) => {
        const items = apps.filter((a) => a.status === status);
        const isOver = overCol === status && dragId !== null;
        return (
          <section
            key={status}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overCol !== status) setOverCol(status);
            }}
            onDragLeave={(e) => {
              // abaikan dragleave ke elemen anak di dalam kolom yang sama
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol((c) => (c === status ? null : c));
            }}
            onDrop={(e) => drop(status, e)}
            aria-label={`Kolom ${STATUS_LABEL[status]}`}
            className={`flex min-w-[250px] flex-1 flex-col rounded-2xl p-3 transition ${
              isOver ? "bg-brand-soft ring-2 ring-brand/40" : "bg-stone-200/50"
            }`}
          >
            <header className="mb-3 flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS_BAR[status]}`} />
                <h3 className="text-sm font-bold">{STATUS_LABEL[status]}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-stone-500">{items.length}</span>
              </div>
              <button
                onClick={() => onAdd(status)}
                className="rounded-full p-1 text-stone-500 transition hover:bg-white hover:text-brand"
                aria-label={`Tambah lamaran di ${STATUS_LABEL[status]}`}
                title={`Tambah di ${STATUS_LABEL[status]}`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </header>

            <div className="flex max-h-[calc(100vh-19rem)] min-h-[120px] flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
              {items.length === 0 && (
                <p className="rounded-xl border border-dashed border-stone-300 px-3 py-6 text-center text-xs text-stone-400">
                  {dragId ? "Lepas di sini" : "Belum ada lamaran"}
                </p>
              )}
              {items.map((a) => {
                const list = pendingByApp.get(a.id) ?? [];
                const next = list[0];
                return (
                  <article
                    key={a.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", a.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(a.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    className={`group cursor-grab rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing ${
                      dragId === a.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-stone-300" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <Link href={`/applications/${a.id}`} draggable={false} className="block truncate text-sm font-bold hover:text-brand hover:underline" title={a.position}>
                          {a.position}
                        </Link>
                        <p className="truncate text-sm text-stone-600">{a.company}</p>
                      </div>
                      <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                        {a.job_url && (
                          <a href={a.job_url} target="_blank" rel="noopener noreferrer" draggable={false} aria-label="Buka link lowongan" className="p-1 text-stone-400 hover:text-brand">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button onClick={() => onEdit(a)} aria-label="Edit lamaran" className="p-1 text-stone-400 hover:text-brand">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {(a.location || a.salary) && (
                      <p className="mt-1.5 truncate pl-[22px] text-xs text-stone-500">{[a.location, a.salary].filter(Boolean).join(" · ")}</p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[22px]">
                      <button onClick={() => onSchedule(a.id)} aria-label="Atur jadwal dan pengingat" className="text-left">
                        {next ? (
                          <span
                            suppressHydrationWarning
                            className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${URGENCY_STYLE[urgency(next, now)]}`}
                          >
                            {KIND_SHORT[next.kind]} · {relativeLabel(next, now)}
                            {list.length > 1 ? ` +${list.length - 1}` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-1 py-0.5 text-[11px] text-stone-400 hover:text-brand">
                            <CalendarPlus className="h-3 w-3" /> Jadwal
                          </span>
                        )}
                      </button>
                      {a.match_score != null && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${MATCH_TONE(a.match_score)}`} title="Skor kecocokan CV">
                          <Sparkles className="h-3 w-3" /> {a.match_score}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between pl-[22px]">
                      <span className="text-[11px] text-stone-400">{a.applied_date ? formatDate(a.applied_date) : ""}</span>
                      {/* Alternatif seret-lepas: layar sentuh & keyboard */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => onMove(a.id, STATUSES[colIndex - 1])}
                          disabled={colIndex === 0}
                          aria-label={`Pindah ke ${colIndex > 0 ? STATUS_LABEL[STATUSES[colIndex - 1]] : ""}`}
                          className="rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-brand disabled:opacity-20 disabled:hover:bg-transparent"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onMove(a.id, STATUSES[colIndex + 1])}
                          disabled={colIndex === STATUSES.length - 1}
                          aria-label={`Pindah ke ${colIndex < STATUSES.length - 1 ? STATUS_LABEL[STATUSES[colIndex + 1]] : ""}`}
                          className="rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-brand disabled:opacity-20 disabled:hover:bg-transparent"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
