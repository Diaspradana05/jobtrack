"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  ImagePlus,
  Loader2,
  Mic,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import AgendaList from "@/components/AgendaList";
import CompanyAvatar from "@/components/CompanyAvatar";
import Markdown from "@/components/Markdown";
import ScheduleDialog from "@/components/ScheduleDialog";
import { createClient } from "@/lib/supabase/client";
import type { FileFormat } from "@/lib/files";
import { tidyJobText } from "@/lib/jobtext";
import { pendingSorted, sortSchedules, type Schedule } from "@/lib/schedule";
import { STATUSES, STATUS_LABEL, STATUS_STYLE, type Application, type Status } from "@/lib/types";
import { formatDate, imageToDataUrl } from "@/lib/utils";

type Task = "match" | "interview" | "cover";

const TABS: { id: Task; label: string; make: string; hint: string }[] = [
  { id: "match", label: "Kecocokan CV", make: "Analisis kecocokan", hint: "Skor, kekuatan, gap, dan saran perbaikan CV untuk lowongan ini." },
  { id: "interview", label: "Persiapan interview", make: "Siapkan interview", hint: "Pertanyaan HR dan teknis beserta saran jawaban berdasarkan CV Anda." },
  { id: "cover", label: "Cover letter", make: "Buat cover letter", hint: "Surat lamaran singkat yang menonjolkan pengalaman paling relevan." },
];

const scoreTone = (n: number) =>
  n >= 75 ? "bg-emerald-100 text-emerald-800" : n >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";

export default function ApplicationDetailClient({
  app,
  schedules,
  hasCv,
  detailReady,
}: {
  app: Application;
  schedules: Schedule[];
  hasCv: boolean;
  detailReady: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const imgRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<Status>(app.status);
  const [jd, setJd] = useState(app.job_description ?? "");
  const [savedJd, setSavedJd] = useState(app.job_description ?? "");
  const [notes, setNotes] = useState(app.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(app.notes ?? "");
  const [results, setResults] = useState<Record<Task, string>>({
    match: app.match_analysis ?? "",
    interview: app.interview_prep ?? "",
    cover: app.cover_letter ?? "",
  });
  const [score, setScore] = useState<number | null>(app.match_score ?? null);
  const [updated, setUpdated] = useState<Partial<Record<Task, string>>>(app.ai_updated ?? {});
  const [tab, setTab] = useState<Task>(
    (["match", "interview", "cover"] as Task[]).find((t) => (t === "match" ? app.match_analysis : t === "interview" ? app.interview_prep : app.cover_letter)) ?? "match",
  );

  const [savingJd, setSavingJd] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState<Task | null>(null);
  const [downloading, setDownloading] = useState<FileFormat | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const jdDirty = jd.trim() !== savedJd.trim();
  const jdReady = savedJd.trim().length >= 30;
  const mine = [...schedules].sort(sortSchedules);
  const ordered = [...pendingSorted(mine), ...mine.filter((s) => s.done)];
  const current = TABS.find((t) => t.id === tab)!;
  const body = results[tab];

  const migrationHint = (m: string) =>
    /column .* does not exist|schema cache/i.test(m)
      ? "Kolom detail belum ada. Jalankan supabase/migration-application-detail.sql di Supabase SQL Editor."
      : m;

  async function changeStatus(next: Status) {
    const prev = status;
    setStatus(next);
    const { error } = await supabase.from("applications").update({ status: next }).eq("id", app.id);
    if (error) {
      setStatus(prev);
      setError(`Gagal mengubah status: ${error.message}`);
      return;
    }
    setError("");
    router.refresh();
  }

  async function saveJd() {
    setSavingJd(true);
    setError("");
    setMsg("");
    const value = jd.trim();
    const { error } = await supabase.from("applications").update({ job_description: value || null }).eq("id", app.id);
    setSavingJd(false);
    if (error) return setError(migrationHint(error.message));
    setSavedJd(value);
    setJd(value);
    setMsg("Deskripsi lowongan tersimpan.");
    router.refresh();
  }

  async function saveNotes() {
    setSavingNotes(true);
    setError("");
    const value = notes.trim();
    const { error } = await supabase.from("applications").update({ notes: value || null }).eq("id", app.id);
    setSavingNotes(false);
    if (error) return setError(error.message);
    setSavedNotes(value);
    setNotes(value);
    router.refresh();
  }

  async function readImage(file: File) {
    if (!file.type.startsWith("image/")) return setError("File harus berupa gambar (PNG/JPG).");
    if (file.size > 15 * 1024 * 1024) return setError("Ukuran gambar maksimal 15 MB.");
    setReading(true);
    setError("");
    setMsg("");
    try {
      const image = await imageToDataUrl(file);
      const res = await fetch("/api/jobtext", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membaca gambar");
      setJd(json.text);
      setMsg("Teks dibaca dari gambar. Periksa dulu, lalu klik Simpan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
    setReading(false);
    if (imgRef.current) imgRef.current.value = "";
  }

  async function generate(task: Task) {
    setError("");
    setMsg("");
    if (jdDirty) return setError("Simpan deskripsi lowongan dulu sebelum membuat hasil AI.");
    if (!jdReady) return setError("Isi deskripsi lowongan dulu (minimal 30 karakter).");
    setLoading(task);
    try {
      const res = await fetch("/api/application-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: app.id, task }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat hasil AI");
      setResults((r) => ({ ...r, [task]: json.text }));
      setUpdated((u) => ({ ...u, [task]: json.generatedAt }));
      if (task === "match") setScore(json.score ?? null);
      setTab(task);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
    setLoading(null);
  }

  async function copy() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function download(format: FileFormat) {
    setDownloading(format);
    setError("");
    try {
      const { buildFile, downloadBlob } = await import("@/lib/files");
      const title =
        tab === "cover"
          ? `Cover Letter ${app.position} ${app.company}`
          : `${tab === "match" ? "Analisis Kecocokan" : "Persiapan Interview"} - ${app.position} di ${app.company}`;
      const { blob, filename } = await buildFile(format, title, body, { showTitle: tab !== "cover" });
      downloadBlob(blob, filename);
    } catch (e) {
      console.error("[file]", e);
      setError("Gagal membuat file. Coba lagi.");
    }
    setDownloading(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/applications" className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Semua lamaran
      </Link>

      {/* Header */}
      <div className="card flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <CompanyAvatar name={app.company} size="lg" />
          <div className="min-w-0">
          <h1 className="page-title">{app.position}</h1>
          <p className="mt-0.5 text-stone-600">{app.company}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
            {app.location && <span>{app.location}</span>}
            {app.salary && <span>{app.salary}</span>}
            <span>Melamar {formatDate(app.applied_date)}</span>
            {app.job_url && (
              <a href={app.job_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                Buka lowongan <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {score != null && (
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${scoreTone(score)}`} title="Skor kecocokan CV">
              Cocok {score}/100
            </span>
          )}
          <Link href={`/applications/${app.id}/interview`} className="btn-ghost">
            <Mic className="h-4 w-4" /> Latihan interview
          </Link>
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value as Status)}
            className={`cursor-pointer rounded-full border-0 px-3 py-1.5 text-sm font-semibold outline-none ${STATUS_STYLE[status]}`}
            aria-label="Ubah status"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!detailReady && (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
          Kolom detail lamaran belum ada di database. Jalankan <code className="rounded bg-white px-1">supabase/migration-application-detail.sql</code>{" "}
          di Supabase SQL Editor, lalu muat ulang halaman ini.
        </p>
      )}
      {error && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {msg && !error && <p className="rounded-2xl bg-brand-soft p-4 text-sm text-brand-dark">{msg}</p>}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Kiri: lowongan, agenda, catatan */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <h2 className="font-bold">Deskripsi lowongan</h2>
            <p className="mb-3 text-xs text-stone-500">Dipakai AI untuk analisis, interview, dan cover letter.</p>
            <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0])} />
            <textarea
              className="input min-h-[220px] leading-relaxed"
              placeholder="Tempel teks lowongan di sini, atau upload gambar lowongan."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" disabled={reading} onClick={() => imgRef.current?.click()}>
                  {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {reading ? "Membaca..." : "Dari gambar"}
                </button>
                <button type="button" className="btn-ghost" disabled={!jd.trim()} onClick={() => setJd(tidyJobText(jd))}>
                  Rapikan
                </button>
              </div>
              <button className="btn" onClick={saveJd} disabled={savingJd || !jdDirty || !detailReady}>
                {savingJd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
              </button>
            </div>
            <p className="mt-1.5 text-xs text-stone-400">
              {jd.length} karakter {jdDirty ? "· belum disimpan" : jdReady ? "· tersimpan" : "· minimal 30"}
            </p>
          </div>

          <div className="card">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-bold">Agenda lamaran ini</h2>
              <button className="btn-ghost" onClick={() => setShowSchedule(true)}>
                <CalendarPlus className="h-4 w-4" /> Atur jadwal
              </button>
            </div>
            <AgendaList items={ordered} emptyText="Belum ada jadwal. Tambahkan deadline, interview, atau follow-up." />
          </div>

          <div className="card">
            <h2 className="mb-2 font-bold">Catatan</h2>
            <textarea className="input min-h-[100px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Kontak recruiter, hasil tes, hal yang perlu diingat..." />
            <div className="mt-2 flex justify-end">
              <button className="btn-ghost" onClick={saveNotes} disabled={savingNotes || notes.trim() === savedNotes.trim()}>
                {savingNotes && <Loader2 className="h-4 w-4 animate-spin" />} Simpan catatan
              </button>
            </div>
          </div>
        </div>

        {/* Kanan: hasil AI */}
        <div className="card lg:col-span-3">
          <div className="mb-4 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  tab === t.id ? "bg-ink text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {t.label}
                {results[t.id] && <span className="ml-1.5 text-emerald-500">●</span>}
              </button>
            ))}
          </div>

          {!hasCv && (
            <p className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              Upload CV dulu agar AI bisa menyesuaikan hasil dengan pengalaman Anda.{" "}
              <Link href="/cv" className="font-semibold underline">
                Ke CV & Match
              </Link>
            </p>
          )}

          {body ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-stone-500">Dibuat {formatDate(updated[tab])}</p>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-ghost" onClick={copy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Tersalin" : "Salin"}
                  </button>
                  {(["pdf", "docx"] as FileFormat[]).map((f) => (
                    <button key={f} className="btn-ghost" onClick={() => download(f)} disabled={downloading !== null}>
                      {downloading === f ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {f === "pdf" ? "PDF" : "Word"}
                    </button>
                  ))}
                  <button className="btn-ghost" onClick={() => generate(tab)} disabled={loading !== null || !hasCv}>
                    {loading === tab ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Buat ulang
                  </button>
                </div>
              </div>
              {tab === "interview" && (
                <Link
                  href={`/applications/${app.id}/interview`}
                  className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-brand-soft p-4 text-sm font-semibold text-brand-dark hover:opacity-90"
                >
                  <span>Sudah membaca? Latih jawabanmu dengan simulasi interview dan dapatkan skor serta umpan balik.</span>
                  <Mic className="h-5 w-5 shrink-0" />
                </Link>
              )}
              <div className={loading === tab ? "opacity-50" : ""}>
                <Markdown text={body} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 px-6 py-12 text-center">
              {loading === tab ? <Loader2 className="h-6 w-6 animate-spin text-brand" /> : <FileText className="h-6 w-6 text-stone-400" />}
              <p className="max-w-sm text-sm text-stone-500">{loading === tab ? "AI sedang menyusun, biasanya 10-30 detik..." : current.hint}</p>
              <button className="btn" onClick={() => generate(tab)} disabled={loading !== null || !hasCv || !jdReady || jdDirty}>
                <Sparkles className="h-4 w-4" /> {current.make}
              </button>
              {!jdReady && <p className="text-xs text-stone-400">Isi dan simpan deskripsi lowongan dulu.</p>}
              {jdReady && jdDirty && <p className="text-xs text-stone-400">Simpan perubahan deskripsi lowongan dulu.</p>}
            </div>
          )}
        </div>
      </div>

      {showSchedule && (
        <ScheduleDialog
          apps={[{ id: app.id, company: app.company, position: app.position }]}
          appId={app.id}
          schedules={schedules}
          onClose={() => setShowSchedule(false)}
        />
      )}
    </div>
  );
}
