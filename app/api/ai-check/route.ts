import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

// Halaman diagnosis: buka /api/ai-check saat sudah login. Menguji tiap model Gemini dengan permintaan kecil
// dan melaporkan lama respons atau pesan errornya. Tidak mengubah data apa pun.
export async function GET() {
  const t0 = Date.now();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authMs = Date.now() - t0;
  if (!user) return Response.json({ error: "Login dulu, lalu buka lagi alamat ini.", authMs }, { status: 401 });

  const primary = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.6-flash,gemini-3.1-flash-lite")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const names = Array.from(new Set([primary, ...fallbacks]));

  const results = await Promise.all(
    names.map(async (name) => {
      const start = Date.now();
      try {
        const { text } = await generateText({
          model: google(name),
          prompt: "Balas satu kata saja: OK",
          maxRetries: 0,
          maxTokens: 20,
          abortSignal: AbortSignal.timeout(20_000),
        });
        return { model: name, ok: true, ms: Date.now() - start, reply: text.slice(0, 40) };
      } catch (e) {
        return { model: name, ok: false, ms: Date.now() - start, error: (e instanceof Error ? e.message : String(e)).slice(0, 400) };
      }
    }),
  );

  return Response.json({
    apiKeySet: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    supabaseAuthMs: authMs,
    region: process.env.VERCEL_REGION || "lokal",
    models: results,
  });
}
