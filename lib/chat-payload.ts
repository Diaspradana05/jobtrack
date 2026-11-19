import type { UIMessage } from "ai";

/**
 * Menyusun isi permintaan chat persis seperti bawaan useChat, tetapi menjaga ukurannya di bawah batas
 * body fungsi Vercel (4,5 MB). Riwayat chat dikirim ulang setiap giliran, termasuk gambar dan teks lampiran,
 * sehingga percakapan panjang bisa melewati batas dan ditolak dengan HTTP 413.
 *
 * Bila terlalu besar: (1) gambar dari pesan lama dibuang, hanya gambar di pesan terakhir yang dipertahankan;
 * (2) bila masih besar, pesan terlama dipangkas. Pesan paling baru selalu utuh.
 */
const LIMIT_CHARS = 3_800_000;

type Payload = Pick<UIMessage, "role" | "content"> & Partial<Pick<UIMessage, "experimental_attachments" | "data" | "annotations" | "toolInvocations" | "parts">>;

const toPayload = (m: UIMessage): Payload => ({
  role: m.role,
  content: m.content,
  ...(m.experimental_attachments !== undefined && { experimental_attachments: m.experimental_attachments }),
  ...(m.data !== undefined && { data: m.data }),
  ...(m.annotations !== undefined && { annotations: m.annotations }),
  ...(m.toolInvocations !== undefined && { toolInvocations: m.toolInvocations }),
  ...(m.parts !== undefined && { parts: m.parts }),
});

const sizeOf = (list: Payload[]) => JSON.stringify(list).length;

export function buildChatMessages(messages: UIMessage[]): Payload[] {
  let out = messages.map(toPayload);
  if (sizeOf(out) <= LIMIT_CHARS) return out;

  // 1) buang gambar dari semua pesan kecuali yang paling akhir
  const lastWithImages = out.map((m) => !!m.experimental_attachments?.length).lastIndexOf(true);
  out = out.map((m, i) => {
    if (i === lastWithImages || !m.experimental_attachments) return m;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { experimental_attachments, ...rest } = m;
    return rest;
  });
  if (sizeOf(out) <= LIMIT_CHARS) return out;

  // 2) pangkas pesan terlama (sisakan minimal pesan terakhir), awali selalu dengan pesan pengguna
  while (out.length > 1 && sizeOf(out) > LIMIT_CHARS) out = out.slice(1);
  while (out.length > 1 && out[0].role !== "user") out = out.slice(1);
  return out;
}
