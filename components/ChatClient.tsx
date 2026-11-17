"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { ArrowRight, Bot, Download, FileSpreadsheet, FileText, Loader2, Paperclip, Presentation, RotateCcw, Send, User, Wrench, X, type LucideIcon } from "lucide-react";
import BarList from "@/components/BarList";
import Markdown from "@/components/Markdown";
import StatusBadge from "@/components/StatusBadge";
import { KIND_ICON } from "@/components/AgendaList";
import { ATTACH_ACCEPT, MAX_DOC_BYTES, MAX_FILES, MAX_IMAGE_BYTES, kindOf, packMessage, unpackMessage, type AttachKind } from "@/lib/attachments";
import { FORMAT_LABEL, type FileFormat } from "@/lib/files";
import { KIND_SHORT, KIND_TONE, URGENCY_STYLE, formatDue, nowWib, relativeLabel, urgency, type Kind } from "@/lib/schedule";
import { STATUSES, STATUS_BAR, STATUS_LABEL, type Status } from "@/lib/types";
import { imageToDataUrl } from "@/lib/utils";

type Mode = "general" | "agent";

const SUGGESTIONS: Record<Mode, string[]> = {
  general: [
    "Bagaimana cara menjawab 'ceritakan tentang dirimu' saat interview magang?",
    "Tips membuat CV untuk fresh graduate tanpa pengalaman kerja",
    "Buatkan CV fresh graduate jurusan Teknik Informatika dalam format PDF",
    "Buatkan tabel perbandingan CV ATS vs CV kreatif",
    "Buatkan presentasi 5 slide tentang persiapan interview kerja",
  ],
  agent: [
    "Catat lamaran ke Tokopedia posisi Data Analyst Intern, status applied",
    "Siapkan interview untuk lamaran Tokopedia",
    "Tampilkan semua lamaran saya",
    "Jadwalkan interview Tokopedia besok jam 10 pagi",
    "Ingatkan saya follow-up Gojek 3 hari lagi",
    "Apa agenda saya minggu ini?",
    "Bagaimana statistik lamaran saya?",
    "Buatkan laporan semua lamaran saya dalam format Excel",
    "Buatkan CV dari data CV saya dalam format Word",
    "Skill apa saja yang ada di CV saya?",
  ],
};

export default function ChatClient() {
  const [mode, setMode] = useState<Mode>("agent");
  const [session, setSession] = useState(0);
  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] max-w-3xl flex-col md:h-[calc(100vh-4rem)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">AI Assistant</h1>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={() => setSession((n) => n + 1)} title="Mulai percakapan baru">
            <RotateCcw className="h-4 w-4" /> Chat baru
          </button>
          <div className="flex rounded-full bg-white p-1 text-sm font-semibold">
          {(["agent", "general"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 transition ${
                mode === m ? "bg-brand text-white" : "text-stone-600"
              }`}
            >
              {m === "agent" ? "Agent pribadi" : "Career coach"}
            </button>
          ))}
          </div>
        </div>
      </div>
      <p className="mb-3 text-sm text-stone-500">
        {mode === "agent"
          ? "Bisa melihat & mengubah data lamaranmu, dan membaca CV yang kamu upload. Klip 📎 untuk melampirkan file."
          : "Chatbot umum untuk tips karier, tanpa akses ke datamu. Klip 📎 untuk melampirkan CV atau lowongan."}
      </p>
      {/* key = mode supaya riwayat chat terpisah per mode */}
      <ChatPanel key={`${mode}-${session}`} mode={mode} />
    </div>
  );
}

type Pending = {
  id: string;
  name: string;
  kind: AttachKind;
  status: "reading" | "ready" | "error";
  dataUrl?: string;
  text?: string;
  error?: string;
};

const MAX_REQUEST_BYTES = 4_000_000; // batas body fungsi serverless Vercel sekitar 4,5 MB

/**
 * Hanya pesan terakhir yang membawa gambar yang tetap mengirim gambarnya; gambar di pesan lama dibuang
 * dari permintaan (tampilan di layar tidak berubah) supaya ukuran permintaan tidak terus membengkak.
 */
function slimMessages<T extends { experimental_attachments?: unknown[] }>(messages: T[]): T[] {
  let lastWithImage = -1;
  messages.forEach((m, i) => {
    if (m.experimental_attachments?.length) lastWithImage = i;
  });
  return messages.map((m, i) => (i === lastWithImage || !m.experimental_attachments?.length ? m : { ...m, experimental_attachments: undefined }));
}

function ChatPanel({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { messages, input, setInput, handleInputChange, status, error, append } = useChat({
    api: "/api/chat",
    experimental_prepareRequestBody: ({ messages }) => {
      const body = { messages: slimMessages(messages), mode };
      if (JSON.stringify(body).length > MAX_REQUEST_BYTES) {
        throw new Error("Percakapan ini sudah terlalu besar untuk dikirim. Klik “Chat baru” untuk memulai lagi.");
      }
      return body;
    },
    maxSteps: 5,
    // agent bisa mengubah data lamaran -> segarkan halaman lain agar tidak menampilkan data lama
    onFinish: () => {
      if (mode === "agent") router.refresh();
    },
  });
  const busy = status === "submitted" || status === "streaming";
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<Pending[]>([]);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const reading = files.some((f) => f.status === "reading");
  const readyCount = files.filter((f) => f.status === "ready").length;

  const patchFile = (id: string, patch: Partial<Pending>) => setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  async function addFiles(list: FileList | File[]) {
    setNotice("");
    const incoming = Array.from(list);
    const room = MAX_FILES - files.length;
    if (room <= 0) return setNotice(`Maksimal ${MAX_FILES} lampiran per pesan.`);
    if (incoming.length > room) setNotice(`Hanya ${room} file pertama yang dilampirkan (maksimal ${MAX_FILES} per pesan).`);

    for (const file of incoming.slice(0, room)) {
      const kind = kindOf(file);
      if (!kind) {
        setNotice(`Format "${file.name}" belum didukung. Gunakan PDF, Word (.docx), Excel, CSV, teks, atau gambar.`);
        continue;
      }
      if (file.size > (kind === "image" ? MAX_IMAGE_BYTES : MAX_DOC_BYTES)) {
        setNotice(`"${file.name}" terlalu besar (maksimal ${kind === "image" ? 15 : 4} MB).`);
        continue;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setFiles((fs) => [...fs, { id, name: file.name || "gambar.png", kind, status: "reading" }]);
      try {
        if (kind === "image") {
          patchFile(id, { status: "ready", dataUrl: await imageToDataUrl(file, { maxDim: 1280, quality: 0.8 }) });
        } else {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/attachments", { method: "POST", body: fd });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Gagal membaca file");
          patchFile(id, { status: "ready", text: json.text });
        }
      } catch (e) {
        patchFile(id, { status: "error", error: e instanceof Error ? e.message : "Gagal membaca file" });
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function send() {
    if (busy || reading) return;
    const ready = files.filter((f) => f.status === "ready");
    const text = input.trim();
    if (!text && ready.length === 0) return;

    const docs = ready.filter((f) => f.kind === "doc").map((f) => ({ name: f.name, text: f.text ?? "" }));
    const images = ready
      .filter((f) => f.kind === "image")
      .map((f) => ({ name: f.name, contentType: "image/jpeg", url: f.dataUrl ?? "" }));
    const content = packMessage(text || "Tolong baca lampiran ini, jelaskan isinya, lalu beri saran yang relevan.", docs);

    setInput("");
    setFiles([]);
    setNotice("");
    await append({ role: "user", content, ...(images.length ? { experimental_attachments: images } : {}) });
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  return (
    <div
      className="card relative flex min-h-0 flex-1 flex-col p-0"
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-brand bg-brand-soft/90 text-sm font-semibold text-brand-dark">
          Lepaskan file di sini (PDF, Word, Excel, gambar)
        </div>
      )}
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-stone-500">Coba salah satu:</p>
            {SUGGESTIONS[mode].map((s) => (
              <button
                key={s}
                onClick={() => append({ role: "user", content: s })}
                className="block w-full rounded-2xl border border-stone-200 px-4 py-3 text-left text-sm hover:bg-brand-soft"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                m.role === "user" ? "bg-ink text-white" : "bg-brand text-white"
              }`}
            >
              {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={`max-w-[85%] space-y-3 ${m.role === "user" ? "text-right" : ""}`}>
              {m.role === "user" &&
                m.experimental_attachments
                  ?.filter((a) => a.contentType?.startsWith("image/"))
                  .map((a, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={`img-${i}`} src={a.url} alt={a.name ?? "Lampiran gambar"} className="ml-auto max-h-52 rounded-2xl border border-stone-200" />
                  ))}
              {m.parts?.map((part, i) => {
                if (part.type === "text") {
                  if (!part.text.trim()) return null;
                  if (m.role === "user") {
                    const { text, docs } = unpackMessage(part.text);
                    return (
                      <div key={i} className="space-y-2">
                        {docs.length > 0 && (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {docs.map((d, j) => (
                              <span key={j} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600">
                                <FileText className="h-3.5 w-3.5 shrink-0 text-brand" />
                                <span className="truncate">{d.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {text && (
                          <div className="inline-block whitespace-pre-wrap rounded-2xl bg-brand px-4 py-2.5 text-left text-sm leading-relaxed text-white">{text}</div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="inline-block rounded-2xl bg-stone-100 px-4 py-2.5 text-left text-sm leading-relaxed">
                      <Markdown text={part.text} />
                    </div>
                  );
                }
                if (part.type === "tool-invocation") {
                  return <ToolCard key={i} invocation={part.toolInvocation} />;
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Berpikir...
          </div>
        )}
        {error && (
          <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            Gagal: {/413|entity too large|payload too large/i.test(error.message) ? "Lampiran terlalu besar untuk dikirim. Gunakan file atau gambar yang lebih kecil, atau klik “Chat baru”." : error.message.slice(0, 300)}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="space-y-2 border-t border-stone-200 p-4"
      >
        {notice && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p>}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f) => (
              <span
                key={f.id}
                className={`inline-flex max-w-[16rem] items-center gap-2 rounded-full border py-1 pl-1.5 pr-2 text-xs font-medium ${
                  f.status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-stone-200 bg-stone-50 text-stone-700"
                }`}
                title={f.status === "error" ? f.error : f.name}
              >
                {f.kind === "image" && f.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.dataUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : f.status === "reading" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-brand" />
                )}
                <span className="truncate">{f.status === "error" ? `${f.name}: ${f.error}` : f.status === "reading" ? `Membaca ${f.name}...` : f.name}</span>
                <button type="button" onClick={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))} aria-label={`Hapus ${f.name}`} className="shrink-0 text-stone-400 hover:text-rose-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input ref={fileRef} type="file" multiple accept={ATTACH_ACCEPT} hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
          <button
            type="button"
            className="btn-ghost !px-3"
            onClick={() => fileRef.current?.click()}
            disabled={busy || files.length >= MAX_FILES}
            aria-label="Lampirkan file"
            title="Lampirkan file (PDF, Word, Excel, CSV, teks, atau gambar)"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            className="input"
            value={input}
            onChange={handleInputChange}
            onPaste={(e) => {
              // tempel gambar/file dari clipboard (mis. screenshot)
              if (e.clipboardData.files.length > 0) {
                e.preventDefault();
                addFiles(e.clipboardData.files);
              }
            }}
            placeholder={readyCount > 0 ? "Tulis pertanyaan tentang lampiran..." : "Tulis pesan..."}
            disabled={busy}
          />
          <button className="btn" disabled={busy || reading || (!input.trim() && readyCount === 0)} aria-label="Kirim">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Generative UI: hasil tool dirender sebagai komponen ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToolCard({ invocation }: { invocation: any }) {
  const { toolName, state } = invocation;

  if (state !== "result") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed border-stone-300 px-4 py-2.5 text-sm text-stone-500">
        <Loader2 className="h-4 w-4 animate-spin" />{" "}
        {toolName === "createFile"
          ? "Menyusun file..."
          : toolName === "prepareForApplication"
            ? "AI sedang menyusun persiapan (10-30 detik)..."
            : `Menjalankan ${toolName}...`}
      </div>
    );
  }

  const result = invocation.result;
  if (result?.error) {
    return <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-left text-sm text-rose-700">{result.error}</p>;
  }

  if (toolName === "createFile") {
    return <FileCard args={invocation.args} result={result} />;
  }

  if (toolName === "listApplications") {
    const list = result.applications ?? [];
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 text-left">
        <p className="mb-2 text-sm font-bold">{list.length} lamaran</p>
        {list.length === 0 ? (
          <p className="text-sm text-stone-500">Belum ada data.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.map((a: { id: string; position: string; company: string; status: Status }) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  <b>{a.position}</b> <span className="text-stone-500">· {a.company}</span>
                </span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (toolName === "getStats") {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 text-left">
        <p className="mb-3 text-sm font-bold">Total {result.total} lamaran</p>
        <BarList
          items={STATUSES.map((s) => ({
            label: STATUS_LABEL[s],
            value: result.counts?.[s] ?? 0,
            className: STATUS_BAR[s],
          }))}
        />
      </div>
    );
  }

  if (toolName === "addApplication" || toolName === "updateApplication") {
    const a = result.application;
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand-soft p-4 text-left text-sm">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-brand-dark">
            {toolName === "addApplication" ? "Lamaran ditambahkan" : "Lamaran diperbarui"}
          </p>
          <p className="truncate font-bold">{a?.position}</p>
          <p className="truncate text-stone-600">{a?.company}</p>
        </div>
        {a?.status && <StatusBadge status={a.status} />}
      </div>
    );
  }

  if (toolName === "addSchedule" || toolName === "completeSchedule") {
    const sc = result.schedule as { company: string; position: string; kind: Kind; due_date: string; due_time: string | null; note: string | null };
    const Icon = KIND_ICON[sc.kind];
    const title =
      toolName === "completeSchedule" ? "Jadwal ditandai selesai" : result.duplicate ? "Jadwal sudah ada (tidak digandakan)" : "Jadwal ditambahkan";
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-soft p-4 text-left text-sm">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${KIND_TONE[sc.kind]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-brand-dark">{title}</p>
          <p className="truncate font-bold">
            {KIND_SHORT[sc.kind]} · {sc.company}
          </p>
          <p className="truncate text-stone-600">{formatDue(sc)}</p>
          {sc.note && <p className="truncate text-xs text-stone-500">{sc.note}</p>}
        </div>
      </div>
    );
  }

  if (toolName === "listSchedules") {
    type Row = { company: string; position: string; kind: Kind; kindLabel: string; due_date: string; due_time: string | null; note: string | null };
    const list: Row[] = result.schedules ?? [];
    const now = nowWib();
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 text-left">
        <p className="mb-2 text-sm font-bold">{list.length} jadwal belum selesai</p>
        {list.length === 0 ? (
          <p className="text-sm text-stone-500">Tidak ada jadwal. Kamu bebas hari ini.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.map((r, i) => {
              const Icon = KIND_ICON[r.kind];
              const probe = { done: false, due_date: r.due_date, due_time: r.due_time };
              return (
                <li key={i} className="flex items-center gap-3 py-2 text-sm">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${KIND_TONE[r.kind]}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {r.kindLabel} · {r.company}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {formatDue(r)}
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${URGENCY_STYLE[urgency(probe, now)]}`}>
                    {relativeLabel(probe, now)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  if (toolName === "prepareForApplication") {
    const a = result.application as { id: string; company: string; position: string };
    const label = ({ interview: "Persiapan interview", match: "Analisis kecocokan", cover: "Cover letter" } as Record<string, string>)[result.task] ?? "Hasil AI";
    const score: number | null = result.score ?? null;
    return (
      <div className="rounded-2xl border border-brand/30 bg-brand-soft p-4 text-left text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-brand-dark">{label} tersimpan di detail lamaran</p>
            <p className="truncate font-bold">{a.position}</p>
            <p className="truncate text-stone-600">{a.company}</p>
          </div>
          {score != null && (
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-dark">Cocok {score}/100</span>
          )}
        </div>
        <details className="mt-3" open>
          <summary className="cursor-pointer text-xs font-semibold text-stone-600">Lihat hasil</summary>
          <div className="mt-2 max-h-96 overflow-y-auto rounded-xl bg-white p-3">
            <Markdown text={result.text} />
          </div>
        </details>
        <Link href={`/applications/${a.id}`} className="mt-3 inline-flex items-center gap-1 font-semibold text-brand hover:underline">
          Buka detail lamaran (unduh PDF/Word) <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  if (toolName === "searchCV") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-left text-xs text-stone-500">
        <Wrench className="h-3.5 w-3.5" /> Membaca {result.passages?.length ?? 0} bagian CV
      </div>
    );
  }

  return null;
}

const FILE_STYLE: Record<FileFormat, { Icon: LucideIcon; tone: string }> = {
  pdf: { Icon: FileText, tone: "bg-rose-50 text-rose-600" },
  docx: { Icon: FileText, tone: "bg-sky-50 text-sky-600" },
  xlsx: { Icon: FileSpreadsheet, tone: "bg-emerald-50 text-emerald-600" },
  pptx: { Icon: Presentation, tone: "bg-orange-50 text-orange-600" },
};

/** Kartu file buatan AI: file dibuat di browser saat tombol Unduh diklik. */
function FileCard({
  args,
  result,
}: {
  args: { format: FileFormat; title: string; content: string };
  result: { filename: string; format?: FileFormat; title?: string };
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const format = (result.format ?? args.format) as FileFormat;
  const { Icon, tone } = FILE_STYLE[format] ?? FILE_STYLE.pdf;

  async function download() {
    setBusy(true);
    setErr("");
    try {
      const { buildFile, downloadBlob } = await import("@/lib/files");
      const { blob } = await buildFile(format, result.title ?? args.title, args.content);
      downloadBlob(blob, result.filename);
    } catch (e) {
      console.error("[file]", e);
      setErr("Gagal membuat file. Coba lagi, atau minta AI memperbaiki isinya.");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 text-left">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{result.filename}</p>
          <p className="text-xs text-stone-500">Dokumen {FORMAT_LABEL[format]} siap diunduh</p>
        </div>
        <button className="btn shrink-0" onClick={download} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Unduh
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-stone-500">Lihat isi</summary>
        <div className="mt-2 max-h-72 overflow-y-auto rounded-xl bg-stone-50 p-3 text-sm">
          <Markdown text={args.content} />
        </div>
      </details>
    </div>
  );
}
