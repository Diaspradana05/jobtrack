import { google } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { embedMany, wrapLanguageModel, type LanguageModelV1, type LanguageModelV1Middleware } from "ai";

// Error yang layak dicoba ulang dengan model cadangan: server sibuk, kuota habis, atau model tidak tersedia.
const FALLBACK_ON =
  /high demand|overload|unavailable|503|429|quota|exhausted|rate|not found|404|no longer available|does not exist|do not have access|decommissioned|deprecated|model_not_found|not supported|permission|tool call validation|validation failed/i;

/** Ambil teks error dari bentuk apa pun (Error, string, atau objek dari SDK/stream). */
export const msgOf = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const inner = o.error as Record<string, unknown> | undefined;
    const m = o.message ?? inner?.message ?? o.responseBody ?? o.statusText;
    if (typeof m === "string" && m) return m;
    try {
      return JSON.stringify(e).slice(0, 300);
    } catch {
      /* abaikan */
    }
  }
  return String(e);
};

/** Gabungkan error tiap model supaya jelas model mana yang gagal dan kenapa. */
function combined(errors: { model: string; error: unknown }[]) {
  if (errors.length === 1) return errors[0].error;
  const text = errors.map((x) => `[${x.model}] ${msgOf(x.error).slice(0, 160)}`).join(" | ");
  return new Error(`Semua model gagal: ${text}`);
}

const OVERLOAD = /high demand|overload|unavailable|503|429|rate|exhausted/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Coba ulang sebentar bila server sedang sibuk (lonjakan permintaan biasanya sementara). */
async function attempt<T>(fn: () => PromiseLike<T>, tries = 2, delayMs = 1500): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!OVERLOAD.test(msgOf(e)) || i === tries - 1) break;
      await sleep(delayMs * (i + 1));
    }
  }
  throw last;
}

export function fallbackMiddleware(fallbacks: LanguageModelV1[]): LanguageModelV1Middleware {
  return {
    wrapGenerate: async ({ doGenerate, params, model }) => {
      try {
        return await attempt(() => doGenerate());
      } catch (first) {
        if (!FALLBACK_ON.test(msgOf(first))) throw first;
        const errors = [{ model: model.modelId, error: first }];
        for (const m of fallbacks) {
          try {
            return await attempt(() => m.doGenerate(params));
          } catch (e) {
            errors.push({ model: m.modelId, error: e });
          }
        }
        throw combined(errors);
      }
    },
    wrapStream: async ({ doStream, params, model }) => {
      try {
        return await attempt(() => doStream());
      } catch (first) {
        if (!FALLBACK_ON.test(msgOf(first))) throw first;
        const errors = [{ model: model.modelId, error: first }];
        for (const m of fallbacks) {
          try {
            return await attempt(() => m.doStream(params));
          } catch (e) {
            errors.push({ model: m.modelId, error: e });
          }
        }
        throw combined(errors);
      }
    },
  };
}

function geminiChain(): { primary: LanguageModelV1; fallbacks: LanguageModelV1[] } {
  const primary = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const names = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.6-flash,gemini-3.1-flash-lite")
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n && n !== primary);
  return { primary: google(primary), fallbacks: names.map((n) => google(n)) };
}

function chain(primary: LanguageModelV1, fallbacks: LanguageModelV1[]): LanguageModelV1 {
  if (fallbacks.length === 0) return primary;
  return wrapLanguageModel({ model: primary, middleware: fallbackMiddleware(fallbacks) });
}

const groqOn = () => process.env.CHAT_PROVIDER === "groq" && !!process.env.GROQ_API_KEY;
const groq = () => createGroq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Model Gemini saja (utama GEMINI_MODEL, cadangan GEMINI_FALLBACK_MODELS).
 * Dipakai untuk PDF CV dan ekstraksi screenshot, yang butuh kemampuan multimodal Gemini.
 */
export const geminiModel = () => {
  const g = geminiChain();
  return chain(g.primary, g.fallbacks);
};

/**
 * Model teks untuk chat/agent/analisis. Jika CHAT_PROVIDER=groq dan GROQ_API_KEY ada, Groq jadi utama
 * dan Gemini jadi cadangan. Jika tidak, memakai Gemini seperti biasa.
 */
export const chatModel = () => {
  const g = geminiChain();
  if (!groqOn()) return chain(g.primary, g.fallbacks);
  return chain(groq()(process.env.GROQ_MODEL || "openai/gpt-oss-120b"), [g.primary, ...g.fallbacks]);
};

/**
 * Model yang bisa membaca gambar (untuk upload gambar lowongan).
 * Urutan: Gemini utama -> Gemini cadangan -> Groq vision (hanya jika GROQ_VISION_MODEL diisi eksplisit,
 * karena nama model vision Groq sering diganti/dihentikan).
 */
export const visionModel = () => {
  const g = geminiChain();
  const groqVision = process.env.GROQ_VISION_MODEL?.trim();
  const extra = groqOn() && groqVision ? [groq()(groqVision)] : [];
  return chain(g.primary, [...g.fallbacks, ...extra]);
};

// 768 dimensi harus sama dengan vector(768) di schema.sql
export const embeddingModel = () =>
  google.textEmbeddingModel(process.env.EMBEDDING_MODEL || "gemini-embedding-001", {
    outputDimensionality: 768,
  });

export function chunkText(text: string, size = 800, overlap = 120): string[] {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size).trim());
    i += size - overlap;
  }
  return chunks.filter((c) => c.length > 20);
}

/** Embedding per batch kecil (API Gemini membatasi jumlah teks per permintaan). */
export async function embedChunks(values: string[], batch = 50): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < values.length; i += batch) {
    const { embeddings } = await embedMany({ model: embeddingModel(), values: values.slice(i, i + batch) });
    out.push(...embeddings);
  }
  return out;
}
