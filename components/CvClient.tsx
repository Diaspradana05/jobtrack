"use client";

import { tidyJobText } from "@/lib/jobtext";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  FileText,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import Markdown from "@/components/Markdown";
import { createClient } from "@/lib/supabase/client";
import { formatDate, imageToDataUrl } from "@/lib/utils";

export default function CvClient({
  current,
}: {
  current: { fileName: string; createdAt: string } | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [readMsg, setReadMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadErr, setUploadErr] = useState("");

  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState<"" | "match" | "cover">("");
  const [result, setResult] = useState("");
  const [matchErr, setMatchErr] = useState("");

  async function removeCv() {
    if (!confirm("Hapus CV yang aktif?")) return;
    const { error } = await supabase
      .from("cv_documents")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) setUploadErr(error.message);
    else {
      setUploadMsg("CV dihapus.");
      setResult("");
    }
    router.refresh();
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard tidak tersedia */
    }
  }

  async function upload(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      setUploadErr("Ukuran file maksimal 4 MB.");
      return;
    }
    setUploading(true);
    setUploadErr("");
    setUploadMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/cv", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload gagal");
      setUploadMsg(`CV berhasil diindeks (${json.chunks} potongan teks).`);
      router.refresh();
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function readImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setMatchErr("File harus berupa gambar (PNG, JPG, atau WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMatchErr("Ukuran gambar maksimal 10 MB.");
      return;
    }
    setReading(true);
    setMatchErr("");
    setReadMsg("");
    setResult("");
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
      setReadMsg(
        "Teks lowongan berhasil dibaca dari gambar. Periksa dulu, lalu klik Analisis kecocokan.",
      );
    } catch (e) {
      setMatchErr(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
    setReading(false);
    if (imgRef.current) imgRef.current.value = "";
  }

  async function run(kind: "match" | "cover") {
    setLoading(kind);
    setMatchErr("");
    setResult("");
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jd, kind }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal");
      setResult(json.text);
    } catch (e) {
      setMatchErr(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
    setLoading("");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="page-title">CV & Match</h1>

      <div className="card">
        <h2 className="font-bold">1. Upload CV</h2>
        <p className="mt-1 text-sm text-stone-500">
          Format PDF atau .txt, maksimal 4 MB. CV diindeks (embedding) agar AI
          bisa mencarinya. CV baru menggantikan yang lama.
        </p>
        {current && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-brand-soft px-4 py-2.5 text-sm font-medium text-brand-dark">
            <span className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">CV aktif: {current.fileName}</span>
              <span className="hidden shrink-0 font-normal text-stone-500 sm:inline">
                · {formatDate(current.createdAt)}
              </span>
            </span>
            <button
              onClick={removeCv}
              className="shrink-0 p-1 text-stone-500 hover:text-rose-600"
              aria-label="Hapus CV"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain"
          hidden
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <button
          className="btn mt-4"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? "Memproses CV..." : current ? "Ganti CV" : "Upload CV"}
        </button>
        {uploadMsg && (
          <p className="mt-3 text-sm text-brand-dark">{uploadMsg}</p>
        )}
        {uploadErr && (
          <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            {uploadErr}
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="font-bold">2. Cocokkan dengan lowongan</h2>
        <p className="mt-1 text-sm text-stone-500">
          Tempel deskripsi lowongan, atau upload screenshot/foto lowongan (PNG,
          JPG, WebP). AI membacanya lalu membandingkannya dengan isi CV-mu.
        </p>
        <input
          ref={imgRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0])}
        />
        <button
          className="btn-ghost mt-4"
          disabled={reading}
          onClick={() => imgRef.current?.click()}
        >
          {reading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          {reading ? "Membaca gambar..." : "Upload gambar lowongan"}
        </button>
        {readMsg && <p className="mt-3 text-sm text-brand-dark">{readMsg}</p>}
        <textarea
          className="input mt-3 min-h-[240px] leading-relaxed"
          placeholder="Tempel deskripsi lowongan di sini..."
          value={jd}
          onChange={(e) => setJd(e.target.value)}
        />
        <div className="mt-1 flex items-center justify-between text-xs text-stone-400">
          <button
            type="button"
            className="font-semibold text-brand hover:underline disabled:opacity-40"
            disabled={jd.trim().length === 0}
            onClick={() => setJd(tidyJobText(jd))}
          >
            Rapikan teks
          </button>
          <span>{jd.length} karakter (minimal 30)</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn"
            disabled={!!loading || !current || jd.trim().length < 30}
            onClick={() => run("match")}
          >
            {loading === "match" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Analisis kecocokan
          </button>
          <button
            className="btn-ghost"
            disabled={!!loading || !current || jd.trim().length < 30}
            onClick={() => run("cover")}
          >
            {loading === "cover" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Buat cover letter
          </button>
        </div>
        {!current && (
          <p className="mt-2 text-xs text-stone-500">
            Upload CV dulu untuk mengaktifkan tombol ini.
          </p>
        )}
        {matchErr && (
          <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            {matchErr}
          </p>
        )}
        {result && (
          <div className="mt-5 rounded-2xl border border-dashed border-stone-300 p-5 text-sm leading-relaxed">
            <div className="mb-3 flex justify-end">
              <button className="btn-ghost" onClick={copyResult}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}{" "}
                {copied ? "Tersalin" : "Salin"}
              </button>
            </div>
            <Markdown text={result} />
          </div>
        )}
      </div>
    </div>
  );
}
