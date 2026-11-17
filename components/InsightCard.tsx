"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import Markdown from "@/components/Markdown";

export default function InsightCard() {
  const [request, setRequest] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuat insight");
      setText(json.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    }
    setLoading(false);
  }

  return (
    <div className="card">
      <form
        className="flex flex-wrap items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading) generate();
        }}
      >
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="h-5 w-5 text-brand" /> Generative AI Insight
        </h2>
        <input
          className="input min-w-[200px] flex-1"
          placeholder="Contoh: kenapa banyak yang ditolak? (opsional)"
          maxLength={300}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
        />
        <button className="btn" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate
        </button>
      </form>
      <div className="mt-5 min-h-[120px] rounded-2xl border border-dashed border-stone-300 p-5 text-sm leading-relaxed">
        {error ? (
          <p className="text-rose-600">{error}</p>
        ) : loading ? (
          <p className="flex items-center gap-2 text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> AI sedang menganalisis lamaranmu...
          </p>
        ) : text ? (
          <Markdown text={text} />
        ) : (
          <p className="text-stone-400">Klik Generate untuk membuat insight dari data lamaranmu.</p>
        )}
      </div>
    </div>
  );
}
