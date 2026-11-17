"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, CalendarPlus, Download, ExternalLink, ImagePlus, LayoutDashboard, ListChecks, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import KanbanBoard from "@/components/KanbanBoard";
import ScheduleDialog from "@/components/ScheduleDialog";
import { createClient } from "@/lib/supabase/client";
import { KIND_SHORT, URGENCY_STYLE, formatDue, nowWib, pendingSorted, relativeLabel, urgency, type Schedule } from "@/lib/schedule";
import { STATUSES, STATUS_LABEL, STATUS_STYLE, type Application, type Status } from "@/lib/types";
import { formatDate, imageToDataUrl, normalizeUrl, todayLocal, toCsv } from "@/lib/utils";

type FormState = {
  company: string;
  position: string;
  status: Status;
  location: string;
  job_url: string;
  salary: string;
  notes: string;
  applied_date: string;
};

const emptyForm = (status: Status = "applied"): FormState => ({
  company: "",
  position: "",
  status,
  location: "",
  job_url: "",
  salary: "",
  notes: "",
  applied_date: todayLocal(),
});

export default function ApplicationsClient({ apps, schedules = [] }: { apps: Application[]; schedules?: Schedule[] }) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<"all" | Status>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "board">("table");
  // perubahan status yang ditampilkan langsung (optimistis) sambil menunggu data dari server
  const [overrides, setOverrides] = useState<Record<string, Status>>({});

  // ingat pilihan tampilan terakhir (dibaca setelah mount agar tidak beda dengan HTML server)
  useEffect(() => {
    try {
      const v = localStorage.getItem("jobtrack.applications.view");
      if (v === "board" || v === "table") setView(v);
    } catch {
      /* localStorage tidak tersedia */
    }
  }, []);
  function changeView(v: "table" | "board") {
    setView(v);
    try {
      localStorage.setItem("jobtrack.applications.view", v);
    } catch {
      /* abaikan */
    }
  }

  // data dari server berubah (setelah router.refresh) -> buang override
  useEffect(() => setOverrides({}), [apps]);
  const effective = useMemo(() => apps.map((a) => (overrides[a.id] ? { ...a, status: overrides[a.id] } : a)), [apps, overrides]);

  // jadwal yang belum selesai, dikelompokkan per lamaran (urut terdekat)
  const pendingByApp = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    pendingSorted(schedules).forEach((s) => map.set(s.application_id, [...(map.get(s.application_id) ?? []), s]));
    return map;
  }, [schedules]);
  const now = nowWib();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: effective.length };
    STATUSES.forEach((s) => (c[s] = effective.filter((a) => a.status === s).length));
    return c;
  }, [effective]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return effective.filter((a) => {
      // di tampilan papan, kolom sudah berfungsi sebagai filter status
      if (view === "table" && filter !== "all" && a.status !== filter) return false;
      if (!q) return true;
      return [a.position, a.company, a.location, a.notes].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [effective, filter, query, view]);

  function openNew(status?: Status) {
    setEditingId(null);
    setForm(emptyForm(status));
    setError("");
    setOpen(true);
  }

  function openEdit(a: Application) {
    setEditingId(a.id);
    setForm({
      company: a.company,
      position: a.position,
      status: a.status,
      location: a.location ?? "",
      job_url: a.job_url ?? "",
      salary: a.salary ?? "",
      notes: a.notes ?? "",
      applied_date: a.applied_date ?? todayLocal(),
    });
    setError("");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const company = form.company.trim();
    const position = form.position.trim();
    if (!company || !position) {
      setError("Posisi dan perusahaan wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      company,
      position,
      status: form.status,
      location: form.location.trim() || null,
      job_url: normalizeUrl(form.job_url),
      salary: form.salary.trim() || null,
      notes: form.notes.trim() || null,
      applied_date: form.applied_date || null,
    };
    const { error } = editingId
      ? await supabase.from("applications").update(payload).eq("id", editingId)
      : await supabase.from("applications").insert(payload);
    setSaving(false);
    if (error) return setError(error.message);
    setOpen(false);
    setPageError("");
    router.refresh();
  }

  async function remove(a: Application) {
    if (!confirm(`Hapus lamaran "${a.position}" di ${a.company}?`)) return;
    const { error } = await supabase.from("applications").delete().eq("id", a.id);
    if (error) setPageError(`Gagal menghapus: ${error.message}`);
    else setPageError("");
    router.refresh();
  }

  async function quickStatus(id: string, status: Status) {
    setOverrides((o) => ({ ...o, [id]: status })); // tampilkan perubahan langsung
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) {
      setOverrides((o) => {
        const next = { ...o };
        delete next[id];
        return next;
      });
      setPageError(`Gagal mengubah status: ${error.message}`);
      return;
    }
    setPageError("");
    router.refresh();
  }

  function exportCsv() {
    const rows = [
      ["Posisi", "Perusahaan", "Status", "Tanggal melamar", "Jadwal berikutnya", "Lokasi", "Gaji", "Link", "Catatan"],
      ...shown.map((a) => [
        a.position,
        a.company,
        STATUS_LABEL[a.status],
        a.applied_date,
        (() => {
          const n = pendingByApp.get(a.id)?.[0];
          return n ? `${KIND_SHORT[n.kind]}: ${formatDue(n)}` : "";
        })(),
        a.location,
        a.salary,
        a.job_url,
        a.notes,
      ]),
    ];
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jobtrack-lamaran-${todayLocal()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Multimodal: screenshot lowongan -> isi form otomatis
  async function scan(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar (PNG/JPG).");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 15 MB.");
      return;
    }
    setScanning(true);
    setError("");
    try {
      const image = await imageToDataUrl(file);
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membaca gambar");
      setForm((f) => ({
        ...f,
        company: json.company || f.company,
        position: json.position || f.position,
        location: json.location || f.location,
        salary: json.salary || f.salary,
        notes: json.notes || f.notes,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
    setScanning(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Applications</h1>
          <p className="page-desc">Kelola semua lamaran kerja dan magangmu di satu tempat.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={exportCsv} disabled={shown.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button className="btn" onClick={() => openNew()}>
            <Plus className="h-4 w-4" /> Tambah lamaran
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-white p-1 text-sm font-semibold" role="tablist" aria-label="Tampilan">
          {(
            [
              ["table", "Tabel", ListChecks],
              ["board", "Papan", LayoutDashboard],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => changeView(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${view === id ? "bg-brand text-white" : "text-stone-600 hover:text-ink"}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            className="input pl-10"
            placeholder="Cari posisi, perusahaan, lokasi..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className={`flex flex-wrap gap-2 ${view === "board" ? "hidden" : ""}`}>
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                filter === s ? "bg-ink text-white" : "bg-white text-stone-600 hover:bg-stone-100"
              }`}
            >
              {s === "all" ? "Semua" : STATUS_LABEL[s]} <span className="opacity-60">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {pageError && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{pageError}</p>}

      {view === "board" ? (
        effective.length === 0 ? (
          <div className="card p-0">
            <EmptyState
              icon={Briefcase}
              title="Belum ada lamaran"
              text="Catat lamaran pertamamu, atau minta AI Assistant mencatatkannya dari screenshot lowongan."
              action={
                <button className="btn" onClick={() => openNew()}>
                  <Plus className="h-4 w-4" /> Tambah lamaran
                </button>
              }
            />
          </div>
        ) : (
          <>
            {query.trim() && shown.length === 0 && (
              <p className="rounded-xl bg-white p-3 text-sm text-stone-500">Tidak ada lamaran yang cocok dengan pencarian ini.</p>
            )}
            <KanbanBoard
              apps={shown}
              pendingByApp={pendingByApp}
              now={now}
              onMove={quickStatus}
              onEdit={openEdit}
              onSchedule={(id) => setScheduleFor(id)}
              onAdd={(st) => openNew(st)}
            />
            <p className="text-xs text-stone-400">Seret kartu ke kolom lain untuk mengubah status, atau pakai tombol panah di kartu.</p>
          </>
        )
      ) : (
      <div className="card overflow-x-auto p-0">
        {shown.length === 0 ? (
          apps.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Belum ada lamaran"
              text="Catat lamaran pertamamu, atau minta AI Assistant mencatatkannya dari screenshot lowongan."
              action={
                <button className="btn" onClick={() => openNew()}>
                  <Plus className="h-4 w-4" /> Tambah lamaran
                </button>
              }
            />
          ) : (
            <EmptyState icon={Search} title="Tidak ditemukan" text="Tidak ada lamaran yang cocok dengan pencarian atau filter ini." />
          )
        ) : (
          <>
            {/* Ponsel: daftar kartu (tabel terlalu lebar untuk layar kecil) */}
            <ul className="divide-y divide-stone-100 md:hidden">
              {shown.map((a) => {
                const list = pendingByApp.get(a.id) ?? [];
                const next = list[0];
                return (
                  <li key={a.id} className="space-y-2.5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/applications/${a.id}`} className="block truncate font-semibold hover:text-brand">
                          {a.position}
                        </Link>
                        <p className="truncate text-sm text-stone-600">{a.company}</p>
                        {(a.location || a.salary) && <p className="truncate text-xs text-stone-500">{[a.location, a.salary].filter(Boolean).join(" · ")}</p>}
                      </div>
                      <select
                        value={a.status}
                        onChange={(e) => quickStatus(a.id, e.target.value as Status)}
                        className={`shrink-0 cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-semibold outline-none ${STATUS_STYLE[a.status]}`}
                        aria-label="Ubah status"
                      >
                        {STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {STATUS_LABEL[st]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button onClick={() => setScheduleFor(a.id)} className="flex items-center gap-1.5 text-left" aria-label="Atur jadwal dan pengingat">
                        {next ? (
                          <span
                            suppressHydrationWarning
                            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${URGENCY_STYLE[urgency(next, now)]}`}
                          >
                            {KIND_SHORT[next.kind]} · {relativeLabel(next, now)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-stone-400">
                            <CalendarPlus className="h-3.5 w-3.5" /> Atur jadwal
                          </span>
                        )}
                        {list.length > 1 && <span className="text-xs text-stone-400">+{list.length - 1}</span>}
                      </button>
                      <div className="flex items-center">
                        {a.job_url && (
                          <a href={a.job_url} target="_blank" rel="noopener noreferrer" aria-label="Buka link lowongan" className="p-2 text-stone-500 hover:text-brand">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        <button onClick={() => openEdit(a)} className="p-2 text-stone-500 hover:text-brand" aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => remove(a)} className="p-2 text-stone-500 hover:text-rose-600" aria-label="Hapus">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-stone-400">Melamar {formatDate(a.applied_date)}</p>
                  </li>
                );
              })}
            </ul>

          <table className="hidden w-full min-w-[860px] text-left text-sm md:table">
            <thead className="border-b border-stone-200 text-stone-500">
              <tr>
                <th className="px-5 py-3 font-medium">Posisi</th>
                <th className="px-5 py-3 font-medium">Perusahaan</th>
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 font-medium">Jadwal</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {shown.map((a) => (
                <tr key={a.id} className="transition hover:bg-stone-50/70">
                  <td className="max-w-[280px] px-5 py-3">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Link href={`/applications/${a.id}`} className="truncate hover:text-brand hover:underline" title="Buka detail lamaran">
                        {a.position}
                      </Link>
                      {a.job_url && (
                        <a href={a.job_url} target="_blank" rel="noopener noreferrer" aria-label="Buka link lowongan" className="shrink-0 text-stone-400 hover:text-brand">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </p>
                    {(a.location || a.salary) && (
                      <p className="truncate text-xs text-stone-500">{[a.location, a.salary].filter(Boolean).join(" · ")}</p>
                    )}
                    {a.notes && (
                      <p className="truncate text-xs text-stone-400" title={a.notes}>
                        {a.notes}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">{a.company}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-stone-500">{formatDate(a.applied_date)}</td>
                  <td className="px-5 py-3">
                    {(() => {
                      const list = pendingByApp.get(a.id) ?? [];
                      const next = list[0];
                      return (
                        <button
                          onClick={() => setScheduleFor(a.id)}
                          className="flex items-center gap-1.5 text-left"
                          aria-label="Atur jadwal dan pengingat"
                        >
                          {next ? (
                            <span
                              suppressHydrationWarning
                              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${URGENCY_STYLE[urgency(next, now)]}`}
                            >
                              {KIND_SHORT[next.kind]} · {relativeLabel(next, now)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-stone-400 hover:text-brand">
                              <CalendarPlus className="h-3.5 w-3.5" /> Atur
                            </span>
                          )}
                          {list.length > 1 && <span className="text-xs text-stone-400">+{list.length - 1}</span>}
                        </button>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={a.status}
                      onChange={(e) => quickStatus(a.id, e.target.value as Status)}
                      className={`cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-semibold outline-none ${STATUS_STYLE[a.status]}`}
                      aria-label="Ubah status"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <button onClick={() => openEdit(a)} className="p-2 text-stone-500 hover:text-brand" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(a)} className="p-2 text-stone-500 hover:text-rose-600" aria-label="Hapus">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>
      )}

      {scheduleFor && (
        <ScheduleDialog
          apps={apps.map((a) => ({ id: a.id, company: a.company, position: a.position }))}
          appId={scheduleFor}
          schedules={schedules}
          onClose={() => setScheduleFor(null)}
        />
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form onSubmit={save} className="max-h-[92vh] w-full max-w-lg animate-pop space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-lift">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingId ? "Edit lamaran" : "Tambah lamaran"}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!editingId && (
              <div className="rounded-2xl bg-brand-soft p-4">
                <p className="text-sm font-semibold text-brand-dark">Punya screenshot lowongan?</p>
                <p className="mb-3 text-xs text-stone-600">AI akan membaca gambar dan mengisi form untukmu.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])}
                />
                <button type="button" className="btn-ghost" disabled={scanning} onClick={() => fileRef.current?.click()}>
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {scanning ? "Membaca gambar..." : "Upload screenshot"}
                </button>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Posisi *">
                <input className="input" required value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </Field>
              <Field label="Perusahaan *">
                <input className="input" required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </Field>
              <Field label="Status">
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tanggal melamar">
                <input type="date" className="input" value={form.applied_date} onChange={(e) => setForm({ ...form, applied_date: e.target.value })} />
              </Field>
              <Field label="Lokasi">
                <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
              <Field label="Gaji / uang saku">
                <input className="input" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
              </Field>
            </div>
            <Field label="Link lowongan">
              <input className="input" placeholder="https://..." value={form.job_url} onChange={(e) => setForm({ ...form, job_url: e.target.value })} />
            </Field>
            <Field label="Catatan">
              <textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>

            {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Batal
              </button>
              <button className="btn" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
