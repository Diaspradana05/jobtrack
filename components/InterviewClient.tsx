"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, Download, Loader2, Mic, MicOff, Play, RotateCcw, Send, Trash2, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FileFormat } from "@/lib/files";
import {
  MODES,
  MODE_LABEL,
  QUESTION_COUNTS,
  gradedTurns,
  reportMarkdown,
  scoreTone,
  scoreWord,
  type InterviewSession,
  type Mode,
  type Turn,
} from "@/lib/interview";
import { formatDate } from "@/lib/utils";

type AppInfo = { id: string; company: string; position: string };

/** Dikte suara memakai Web Speech API bawaan browser (Chrome/Edge/Safari); tersembunyi bila tidak didukung. */
function useDictation(onText: (t: string) => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => recRef.current?.stop();
  }, []);

  function toggle() {
    if (listening) return recRef.current?.stop();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "id-ID";
    r.continuous = true;
    r.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript;
      if (t.trim()) onText(t.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    r.start();
    setListening(true);
  }

  return { supported, listening, toggle };
}

function Bullets({ title, items, tone }: { title: string; items?: string[]; tone: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2">
      <p className={`text-xs font-bold ${tone}`}>{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function FeedbackCard({ t }: { t: Turn }) {
  if (t.score === undefined) return null;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${scoreTone(t.score)}`}>{t.score}/10</span>
        <span className="text-xs text-stone-500">{scoreWord(t.score)}</span>
      </div>
      <Bullets title="Yang sudah baik" items={t.good} tone="text-emerald-700" />
      <Bullets title="Yang perlu diperbaiki" items={t.improve} tone="text-amber-700" />
      {t.sample && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-brand">Lihat contoh jawaban yang lebih kuat</summary>
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-brand-soft p-3 leading-relaxed text-stone-700">{t.sample}</p>
        </details>
      )}
    </div>
  );
}

function QuestionBubble({ t }: { t: Turn }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white">
        <Bot className="h-4 w-4" />
      </div>
      <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-stone-100 px-4 py-3 text-sm leading-relaxed">
        {t.isFollowUp && <span className="mb-1 block text-xs font-semibold text-stone-500">Pertanyaan lanjutan</span>}
        {t.q}
      </div>
    </div>
  );
}

function AnswerBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-brand px-4 py-3 text-sm leading-relaxed text-white">{text}</div>
    </div>
  );
}

function ReportView({ s, app, onAgain }: { s: InterviewSession; app: AppInfo; onAgain: () => void }) {
  const [downloading, setDownloading] = useState<FileFormat | null>(null);
  const [error, setError] = useState("");
  const graded = gradedTurns(s);

  async function download(format: FileFormat) {
    setDownloading(format);
    setError("");
    try {
      const { buildFile, downloadBlob } = await import("@/lib/files");
      const { blob, filename } = await buildFile(format, `Rapor Simulasi Interview - ${app.position} ${app.company}`, reportMarkdown(app, s), {
        showTitle: false,
      });
      downloadBlob(blob, filename);
    } catch (e) {
      console.error("[file]", e);
      setError("Gagal membuat file. Coba lagi.");
    }
    setDownloading(null);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-stone-500">
              <Trophy className="h-4 w-4 text-brand" /> Rapor simulasi · {formatDate(s.finished_at ?? s.created_at)}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              {MODE_LABEL[s.mode]} · {graded.length} pertanyaan dijawab
            </p>
          </div>
          {s.avg_score != null && (
            <div className={`rounded-2xl px-5 py-3 text-center ${scoreTone(s.avg_score)}`}>
              <p className="text-3xl font-extrabold leading-none">{s.avg_score}</p>
              <p className="mt-1 text-xs font-semibold">dari 10 · {scoreWord(s.avg_score)}</p>
            </div>
          )}
        </div>
        {s.report && <p className="mt-4 leading-relaxed text-stone-700">{s.report.summary}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {(["pdf", "docx"] as FileFormat[]).map((f) => (
            <button key={f} className="btn-ghost" onClick={() => download(f)} disabled={downloading !== null}>
              {downloading === f ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {f === "pdf" ? "Unduh PDF" : "Unduh Word"}
            </button>
          ))}
          <button className="btn" onClick={onAgain}>
            <RotateCcw className="h-4 w-4" /> Simulasi lagi
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </div>

      {s.report && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "Kekuatan", items: s.report.strengths, tone: "text-emerald-700" },
            { title: "Perlu dilatih", items: s.report.toPractice, tone: "text-amber-700" },
            { title: "Langkah berikutnya", items: s.report.nextSteps, tone: "text-brand" },
          ].map((c) => (
            <div key={c.title} className="card text-sm">
              <p className={`font-bold ${c.tone}`}>{c.title}</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed">
                {c.items.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 font-bold">Detail jawaban</h2>
        <div className="space-y-3">
          {graded.map((t, i) => (
            <details key={i} className="rounded-2xl border border-stone-200 p-4" open={i === 0}>
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${scoreTone(t.score ?? 0)}`}>{t.score}/10</span>
                <span className="min-w-0">{t.q}</span>
              </summary>
              <div className="mt-3 space-y-3">
                <AnswerBubble text={t.a ?? ""} />
                <FeedbackCard t={t} />
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function InterviewClient({
  app,
  sessions,
  hasCv,
  jdReady,
  tableReady,
}: {
  app: AppInfo;
  sessions: InterviewSession[];
  hasCv: boolean;
  jdReady: boolean;
  tableReady: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const endRef = useRef<HTMLDivElement>(null);

  const [active, setActive] = useState<InterviewSession | null>(sessions.find((s) => s.status === "active") ?? null);
  const [viewing, setViewing] = useState<InterviewSession | null>(null);
  const [mode, setMode] = useState<Mode>("mixed");
  const [total, setTotal] = useState<number>(5);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<"" | "start" | "answer" | "finish">("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const dictation = useDictation((t) => setAnswer((prev) => (prev ? `${prev} ${t}` : t)));

  const finished = sessions.filter((s) => s.status === "finished");
  const answeredCount = active ? active.turns.filter((t) => t.a !== undefined).length : 0;
  const waiting = active ? active.turns[active.turns.length - 1] : undefined;
  const awaitingAnswer = !!waiting && waiting.a === undefined;
  const needsReport = !!active && !awaitingAnswer && answeredCount > 0;
  const canStart = hasCv && jdReady && tableReady;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.turns.length, busy]);

  async function call(body: object): Promise<{ session: InterviewSession; warning?: string }> {
    const res = await fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Terjadi kesalahan");
    return json;
  }

  async function start() {
    setBusy("start");
    setError("");
    setWarning("");
    try {
      const { session } = await call({ action: "start", applicationId: app.id, mode, total });
      setViewing(null);
      setAnswer("");
      setActive(session);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
    setBusy("");
  }

  async function send() {
    if (!active || busy) return;
    if (answer.trim().length < 5) return setError("Tulis jawaban Anda dengan lebih lengkap.");
    setBusy("answer");
    setError("");
    setWarning("");
    try {
      if (dictation.listening) dictation.toggle();
      const { session, warning } = await call({ action: "answer", sessionId: active.id, answer });
      setAnswer("");
      if (warning) setWarning(warning);
      if (session.status === "finished") {
        setActive(null);
        setViewing(session);
        router.refresh();
      } else {
        setActive(session);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
    setBusy("");
  }

  async function finishNow(confirmFirst: boolean) {
    if (!active || busy) return;
    if (confirmFirst && !confirm("Akhiri sesi sekarang? Rapor dibuat dari jawaban yang sudah Anda kirim.")) return;
    setBusy("finish");
    setError("");
    setWarning("");
    try {
      const { session } = await call({ action: "finish", sessionId: active.id });
      setActive(null);
      setViewing(session);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
    setBusy("");
  }

  async function remove(s: InterviewSession) {
    if (!confirm("Hapus sesi simulasi ini?")) return;
    const { error } = await supabase.from("interview_sessions").delete().eq("id", s.id);
    if (error) return setError(error.message);
    if (viewing?.id === s.id) setViewing(null);
    if (active?.id === s.id) setActive(null);
    router.refresh();
  }

  const chronological = [...finished].reverse();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/applications/${app.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Detail lamaran
      </Link>
      <div>
        <h1 className="page-title">Simulasi interview</h1>
        <p className="text-stone-600">
          {app.position} di {app.company}
        </p>
      </div>

      {!tableReady && (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
          Tabel simulasi belum dibuat. Jalankan <code className="rounded bg-white px-1">supabase/migration-interview.sql</code> di Supabase SQL Editor, lalu muat ulang halaman ini.
        </p>
      )}
      {error && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {warning && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">{warning}</p>}

      {/* ===== Sesi berjalan ===== */}
      {active && (
        <div className="card space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-stone-500">
              <span>
                {needsReport ? "Semua pertanyaan terjawab" : `Pertanyaan ${answeredCount + 1} dari ${active.total_questions}`}
              </span>
              <span>{MODE_LABEL[active.mode]}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${Math.min(100, (answeredCount / active.total_questions) * 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            {active.turns.map((t, i) => (
              <div key={i} className="space-y-3">
                <QuestionBubble t={t} />
                {t.a !== undefined && <AnswerBubble text={t.a} />}
                {t.score !== undefined && <FeedbackCard t={t} />}
              </div>
            ))}
          </div>

          {busy === "answer" || busy === "finish" ? (
            <p className="flex items-center gap-2 rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              {busy === "finish" ? "Menyusun rapor..." : "Pewawancara sedang menilai jawaban Anda..."}
            </p>
          ) : needsReport ? (
            <div className="flex justify-end">
              <button className="btn" onClick={() => finishNow(false)}>
                <Trophy className="h-4 w-4" /> Buat rapor
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                className="input min-h-[120px] leading-relaxed"
                placeholder="Ketik jawaban Anda seperti saat interview sungguhan..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {dictation.supported && (
                    <button
                      type="button"
                      onClick={dictation.toggle}
                      className={`btn-ghost ${dictation.listening ? "!bg-rose-100 !text-rose-700" : ""}`}
                      title="Jawab dengan suara (bahasa Indonesia)"
                    >
                      {dictation.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {dictation.listening ? "Berhenti" : "Dikte"}
                    </button>
                  )}
                  {answeredCount > 0 && (
                    <button type="button" className="text-sm font-semibold text-stone-500 hover:text-rose-600" onClick={() => finishNow(true)}>
                      Akhiri sesi
                    </button>
                  )}
                </div>
                <button className="btn" onClick={send} disabled={answer.trim().length < 5}>
                  <Send className="h-4 w-4" /> Kirim jawaban
                </button>
              </div>
              <p className="text-xs text-stone-400">Tips: Ctrl/⌘ + Enter untuk mengirim. Jawab dengan contoh nyata dan hasil yang bisa diukur.</p>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* ===== Rapor ===== */}
      {!active && viewing && <ReportView s={viewing} app={app} onAgain={() => setViewing(null)} />}

      {/* ===== Pengaturan awal ===== */}
      {!active && !viewing && (
        <div className="card space-y-5">
          <div>
            <h2 className="font-bold">Latihan dengan pewawancara AI</h2>
            <p className="mt-1 text-sm text-stone-500">
              AI bertanya satu per satu berdasarkan lowongan dan CV Anda, menilai tiap jawaban, lalu memberi rapor di akhir.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Fokus pertanyaan</p>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    mode === m ? "bg-ink text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Jumlah pertanyaan</p>
            <div className="flex gap-2">
              {QUESTION_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setTotal(n)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    total === n ? "bg-ink text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {n} pertanyaan
                </button>
              ))}
            </div>
          </div>

          {!hasCv && (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              Upload CV dulu agar pertanyaan dan penilaian sesuai pengalaman Anda.{" "}
              <Link href="/cv" className="font-semibold underline">
                Ke CV & Match
              </Link>
            </p>
          )}
          {!jdReady && (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              Isi dan simpan deskripsi lowongan dulu.{" "}
              <Link href={`/applications/${app.id}`} className="font-semibold underline">
                Ke detail lamaran
              </Link>
            </p>
          )}

          <button className="btn" onClick={start} disabled={!canStart || busy === "start"}>
            {busy === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {busy === "start" ? "Menyiapkan pertanyaan..." : "Mulai simulasi"}
          </button>
        </div>
      )}

      {/* ===== Riwayat ===== */}
      {!active && finished.length > 0 && (
        <div className="card">
          <h2 className="mb-1 font-bold">Riwayat simulasi</h2>

          {chronological.length >= 2 && (
            <div className="mb-4 mt-2">
              <p className="mb-2 text-xs text-stone-500">Perkembangan skor rata-rata</p>
              <div className="flex h-24 items-end gap-2">
                {chronological.map((s) => (
                  <div key={s.id} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-xs font-semibold text-stone-600">{s.avg_score ?? "-"}</span>
                    <div className="w-full max-w-[48px] rounded-t-lg bg-brand/80" style={{ height: `${Math.max(6, (s.avg_score ?? 0) * 8)}px` }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <ul className="divide-y divide-stone-100">
            {finished.map((s, i) => {
              const prev = finished[i + 1];
              const delta = s.avg_score != null && prev?.avg_score != null ? Math.round((s.avg_score - prev.avg_score) * 10) / 10 : null;
              return (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <button onClick={() => setViewing(s)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold">{formatDate(s.finished_at ?? s.created_at)}</p>
                    <p className="truncate text-xs text-stone-500">
                      {MODE_LABEL[s.mode]} · {gradedTurns(s).length} pertanyaan
                    </p>
                  </button>
                  {delta != null && delta !== 0 && (
                    <span className={`text-xs font-semibold ${delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                    </span>
                  )}
                  {s.avg_score != null && (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${scoreTone(s.avg_score)}`}>{s.avg_score}/10</span>
                  )}
                  <button onClick={() => remove(s)} className="p-1.5 text-stone-400 hover:text-rose-600" aria-label="Hapus sesi">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
