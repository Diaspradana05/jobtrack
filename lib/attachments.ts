/** Helper lampiran chat yang aman dipakai di server maupun browser. */

export const MAX_FILES = 3;
// Vercel membatasi body permintaan serverless sekitar 4,5 MB, jadi dokumen dibatasi 4 MB.
export const MAX_DOC_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_DOC_CHARS = 20000;
export const ATTACH_ACCEPT = ".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json,image/*";

export type AttachKind = "image" | "doc";

/** Jenis lampiran, atau null bila formatnya tidak didukung. */
export function kindOf(file: { name: string; type: string }): AttachKind | null {
  if (file.type.startsWith("image/")) return "image";
  return /\.(pdf|docx|xlsx|xls|csv|txt|md|json)$/i.test(file.name) ? "doc" : null;
}

const cleanName = (n: string) => n.replace(/[\][\n\r]/g, " ").trim().slice(0, 120) || "lampiran";

/**
 * Isi dokumen disisipkan ke teks pesan di antara penanda, supaya ikut terkirim pada setiap giliran
 * dan tetap bisa disembunyikan di tampilan (lihat unpackMessage).
 */
export function packMessage(text: string, docs: { name: string; text: string }[]): string {
  const blocks = docs.map(
    (d) => `[[LAMPIRAN: ${cleanName(d.name)}]]\n${d.text.replace(/\[\[\/LAMPIRAN\]\]/g, "[[ /LAMPIRAN ]]")}\n[[/LAMPIRAN]]`,
  );
  return [text.trim(), ...blocks].filter(Boolean).join("\n\n");
}

/** Pisahkan teks pengguna dari blok lampiran untuk ditampilkan. */
export function unpackMessage(content: string): { text: string; docs: { name: string; chars: number }[] } {
  const docs: { name: string; chars: number }[] = [];
  const text = content
    .replace(/\n*\[\[LAMPIRAN: ([^\]\n]+)\]\]\n([\s\S]*?)\n\[\[\/LAMPIRAN\]\]/g, (_m, name: string, body: string) => {
      docs.push({ name, chars: body.length });
      return "";
    })
    .trim();
  return { text, docs };
}
