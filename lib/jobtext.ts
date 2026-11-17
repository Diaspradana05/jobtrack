const SECTION =
  /^(tentang\s+(kami|perusahaan|posisi)|deskripsi(\s+(pekerjaan|posisi))?|job\s+description|about\s+(us|the\s+role|the\s+job)|tanggung\s+jawab|responsibilit(y|ies)|what\s+you('|’)?ll\s+do|kualifikasi|persyaratan|requirements?|qualifications?|what\s+we('|’)?re\s+looking\s+for|benefits?|keuntungan|yang\s+kami\s+tawarkan|what\s+we\s+offer|lokasi|location|cara\s+melamar|how\s+to\s+apply|skills?|keahlian)\s*:?\s*$/i;

/**
 * Merapikan teks lowongan (hasil OCR gambar atau tempelan): bullet seragam "- ",
 * penanda markdown dibuang, baris yang terpotong digabung, judul bagian diberi jarak.
 */
export function tidyJobText(raw: string): string {
  let t = raw.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/<br\s*\/?>/gi, "\n");

  // buang sisa markdown
  t = t
    .replace(/\*\*|__/g, "")
    .replace(/^[ \t]*#{1,6}[ \t]*/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*\|?[-: |]{3,}\|?[ \t]*$/gm, "")
    .replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_, inner: string) =>
      inner
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
        .join(" - "),
    );

  // bullet seragam
  t = t.replace(/^[ \t]*[•●▪◦·○■□▶►➤✓✔*–—-][ \t]+/gm, "- ");
  t = t.replace(/^[ \t]*(\d+)[).][ \t]+/gm, "$1. ");

  // baris lanjutan yang menjorok (bukan bullet) digabung ke baris di atasnya
  t = t.replace(/([^\n])\n[ \t]+(?=\S)/g, "$1 ");

  t = t.replace(/[ \t]+$/gm, "").replace(/[ \t]{2,}/g, " ");

  // gabungkan baris yang terpotong (baris berikutnya diawali huruf kecil = lanjutan kalimat)
  t = t.replace(/([^\n.:;!?)\-])\n(?=[a-z])/g, "$1 ");

  // judul bagian: beri jarak dan akhiri dengan titik dua
  t = t
    .split("\n")
    .map((line) => {
      const s = line.trim();
      if (s && SECTION.test(s)) return `\n${s.replace(/\s*:?\s*$/, "")}:`;
      return line;
    })
    .join("\n");

  return t.replace(/\n{3,}/g, "\n\n").trim();
}
