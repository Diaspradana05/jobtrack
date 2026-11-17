"use client";

/**
 * Generator file di browser (PDF, Word, Excel, PowerPoint) dari teks markdown buatan AI.
 * Library dimuat dinamis saat dibutuhkan supaya halaman lain tidak ikut berat.
 */
import { parseMarkdown, type Block } from "@/components/Markdown";

export type FileFormat = "pdf" | "docx" | "xlsx" | "pptx";

export const FORMAT_LABEL: Record<FileFormat, string> = {
  pdf: "PDF",
  docx: "Word",
  xlsx: "Excel",
  pptx: "PowerPoint",
};

const MIME: Record<FileFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const BRAND = "0F6E56"; // hijau JobTrack
const BRAND_RGB: [number, number, number] = [15, 110, 86];

// ---------- helper teks ----------

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/;

/** Teks polos tanpa penanda markdown. */
function plain(t: string): string {
  return t
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\s][^*]*)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    .trim();
}

/** Font bawaan PDF hanya mendukung Latin-1: ganti simbol umum, buang sisanya (mis. emoji). */
function pdfSafe(s: string): string {
  return s
    .replace(/[→➜➔➤]/g, "->")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•●▪◦·]/g, "-")
    .replace(/[^\n\x20-\x7E\u00A0-\u00FF]/g, "");
}

type Run = { text: string; bold?: boolean; italics?: boolean; br?: boolean };

/** Pecah teks inline menjadi potongan (tebal/miring) untuk Word. */
function toRuns(text: string): Run[] {
  const out: Run[] = [];
  text.split(/<br\s*\/?>/i).forEach((line, li) => {
    if (li > 0) out.push({ text: "", br: true });
    line
      .trim()
      .split(INLINE)
      .forEach((p) => {
        if (!p) return;
        if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) out.push({ text: p.slice(2, -2), bold: true });
        else if (p.length > 2 && p.startsWith("`") && p.endsWith("`")) out.push({ text: p.slice(1, -1) });
        else if (/^\[[^\]]+\]\(https?:\/\/[^)\s]+\)$/.test(p)) out.push({ text: plain(p) });
        else if (p.length > 2 && p.startsWith("*") && p.endsWith("*")) out.push({ text: p.slice(1, -1), italics: true });
        else out.push({ text: p });
      });
  });
  return out;
}

export function safeFilename(title: string, ext: string): string {
  const base =
    title
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 60) || "dokumen";
  return `${base}.${ext}`;
}

/** Judul dokumen: heading level 1 pertama bila ada, kalau tidak pakai judul dari AI. */
function prepare(title: string, content: string): { docTitle: string; blocks: Block[] } {
  const blocks = parseMarkdown(content);
  const firstH1 = blocks.find((b) => b.type === "h" && b.level === 1);
  return { docTitle: firstH1 && firstH1.type === "h" ? plain(firstH1.text) : title, blocks };
}

const padRow = (row: string[], n: number) => Array.from({ length: n }, (_, i) => row[i] ?? "");

// ---------- PDF ----------

async function buildPdf(title: string, content: string, showTitle = true): Promise<Blob> {
  // diketik longgar (any): build tidak boleh gagal hanya karena perbedaan tipe antarversi library
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = (await import("jspdf")) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable = ((await import("jspdf-autotable")) as any).default;
  const { docTitle, blocks } = prepare(title, content);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({ title: docTitle, creator: "JobTrack" });
  const W = 210;
  const H = 297;
  const M = 20;
  const CW = W - 2 * M;
  const PT = 0.3528; // 1 pt = 0.3528 mm
  let y = M;

  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };

  function text(raw: string, o: { size?: number; bold?: boolean; indent?: number; gap?: number; color?: [number, number, number] } = {}) {
    const { size = 11, bold = false, indent = 0, gap = 2, color = [30, 30, 30] } = o;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(pdfSafe(plain(raw)), CW - indent) as string[];
    const lh = size * PT * 1.4;
    for (const ln of lines) {
      ensure(lh);
      doc.text(ln, M + indent, y + size * PT * 0.85);
      y += lh;
    }
    y += gap;
  }

  let titled = false;
  if (showTitle && !blocks.some((b) => b.type === "h" && b.level === 1)) {
    text(docTitle, { size: 20, bold: true, color: BRAND_RGB, gap: 4 });
    titled = true;
  }

  for (const b of blocks) {
    if (b.type === "h") {
      if (b.level === 1) {
        text(b.text, { size: 20, bold: true, color: BRAND_RGB, gap: 2 });
        titled = true;
      } else if (b.level === 2) {
        ensure(14);
        y += 3;
        text(b.text, { size: 13, bold: true, color: BRAND_RGB, gap: 1 });
        doc.setDrawColor(...BRAND_RGB);
        doc.setLineWidth(0.3);
        doc.line(M, y, W - M, y);
        y += 3;
      } else {
        y += 1.5;
        text(b.text, { size: 11.5, bold: true, gap: 1.5 });
      }
    } else if (b.type === "p") {
      text(b.text, { gap: 3 });
    } else if (b.type === "hr") {
      ensure(6);
      doc.setDrawColor(190, 190, 190);
      doc.setLineWidth(0.2);
      doc.line(M, y + 2, W - M, y + 2);
      y += 6;
    } else if (b.type === "ul" || b.type === "ol") {
      let n = 0;
      for (const it of b.items) {
        const ind = it.indent ? 10 : 4;
        n += it.indent ? 0 : 1;
        ensure(6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        if (b.type === "ul") {
          doc.setFillColor(30, 30, 30);
          doc.circle(M + ind, y + 11 * PT * 0.6, 0.55, "F");
        } else if (!it.indent) {
          doc.text(`${n}.`, M + ind - 3.5, y + 11 * PT * 0.85);
        }
        text(it.text, { indent: ind + 3, gap: 0.8 });
      }
      y += 2;
    } else if (b.type === "table") {
      const cols = Math.max(b.head?.length ?? 0, ...b.rows.map((r) => r.length), 1);
      ensure(16);
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M, bottom: M },
        head: b.head ? [padRow(b.head, cols).map((c) => pdfSafe(plain(c)))] : undefined,
        body: b.rows.map((r) => padRow(r, cols).map((c) => pdfSafe(plain(c)))),
        theme: "grid",
        styles: { font: "helvetica", fontSize: 9.5, cellPadding: 2, overflow: "linebreak", lineColor: [210, 210, 210], textColor: [30, 30, 30] },
        headStyles: { fillColor: BRAND_RGB, textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [246, 248, 247] },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 5;
    }
  }
  void titled;

  // nomor halaman
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(140, 140, 140);
    doc.text(`${i} / ${pages}`, W - M, H - 10, { align: "right" });
  }
  return doc.output("blob");
}

// ---------- Word ----------

async function buildDocx(title: string, content: string, showTitle = true): Promise<Blob> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle } = d;
  const { docTitle, blocks } = prepare(title, content);

  const mkRuns = (text: string, base: { bold?: boolean } = {}) =>
    toRuns(text).map((r) =>
      r.br ? new TextRun({ break: 1 }) : new TextRun({ text: r.text, bold: r.bold || base.bold, italics: r.italics }),
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];
  if (showTitle && !blocks.some((b) => b.type === "h" && b.level === 1)) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(docTitle)] }));
  }

  const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3] as const;

  for (const b of blocks) {
    if (b.type === "h") {
      children.push(new Paragraph({ heading: HEADINGS[Math.min(b.level, 3) - 1], children: mkRuns(b.text) }));
    } else if (b.type === "p") {
      children.push(new Paragraph({ spacing: { after: 120 }, children: mkRuns(b.text) }));
    } else if (b.type === "hr") {
      children.push(
        new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "AAAAAA", space: 1 } } }),
      );
    } else if (b.type === "ul") {
      for (const it of b.items) {
        children.push(new Paragraph({ bullet: { level: it.indent ? 1 : 0 }, spacing: { after: 60 }, children: mkRuns(it.text) }));
      }
    } else if (b.type === "ol") {
      let n = 0;
      for (const it of b.items) {
        n += it.indent ? 0 : 1;
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            indent: { left: it.indent ? 1080 : 540, hanging: 360 },
            children: [new TextRun(it.indent ? "-\t" : `${n}.\t`), ...mkRuns(it.text)],
          }),
        );
      }
    } else if (b.type === "table") {
      const cols = Math.max(b.head?.length ?? 0, ...b.rows.map((r) => r.length), 1);
      const colW = Math.floor(9026 / cols);
      const cell = (text: string, header: boolean) =>
        new TableCell({
          width: { size: colW, type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          shading: header ? { type: ShadingType.CLEAR, fill: "DDEFE8", color: "auto" } : undefined,
          children: [new Paragraph({ children: mkRuns(text, { bold: header }) })],
        });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = [];
      if (b.head) rows.push(new TableRow({ tableHeader: true, children: padRow(b.head, cols).map((c) => cell(c, true)) }));
      b.rows.forEach((r) => rows.push(new TableRow({ children: padRow(r, cols).map((c) => cell(c, false)) })));
      children.push(new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: Array(cols).fill(colW), rows }));
      children.push(new Paragraph({ spacing: { after: 120 } }));
    }
  }

  const doc = new Document({
    creator: "JobTrack",
    title: docTitle,
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, color: BRAND, font: "Calibri" }, paragraph: { spacing: { before: 120, after: 120 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 26, bold: true, color: BRAND, font: "Calibri" },
          paragraph: { spacing: { before: 240, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND, space: 2 } } } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 23, bold: true, font: "Calibri" }, paragraph: { spacing: { before: 160, after: 60 } } },
      ],
    },
    sections: [{ children }],
  });
  return Packer.toBlob(doc);
}

// ---------- Excel ----------

function cellValue(raw: string): string | number {
  const t = plain(raw);
  return /^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(t) ? Number(t) : t;
}

async function buildXlsx(title: string, content: string): Promise<Blob> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX: any = await import("xlsx");
  const { blocks } = prepare(title, content);
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  const sheetName = (raw: string, fallback: string) => {
    let base = (plain(raw).replace(/[\\/?*[\]:]/g, " ").trim() || fallback).slice(0, 28);
    let name = base;
    let i = 2;
    while (used.has(name.toLowerCase())) name = `${base.slice(0, 25)} ${i++}`;
    used.add(name.toLowerCase());
    return name;
  };

  const fit = (aoa: (string | number)[][]) =>
    Array.from({ length: Math.max(...aoa.map((r) => r.length), 1) }, (_, c) => ({
      wch: Math.min(60, Math.max(10, ...aoa.map((r) => String(r[c] ?? "").length + 2))),
    }));

  let heading = "";
  let tableNo = 0;
  for (const b of blocks) {
    if (b.type === "h") heading = b.text;
    if (b.type !== "table") continue;
    tableNo++;
    const cols = Math.max(b.head?.length ?? 0, ...b.rows.map((r) => r.length), 1);
    const aoa: (string | number)[][] = [];
    if (b.head) aoa.push(padRow(b.head, cols).map(plain));
    b.rows.forEach((r) => aoa.push(padRow(r, cols).map(cellValue)));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = fit(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheetName(heading, `Tabel ${tableNo}`));
  }

  // tanpa tabel: tulis isi teks per baris di satu sheet
  if (tableNo === 0) {
    const aoa: string[][] = [];
    for (const b of blocks) {
      if (b.type === "h" || b.type === "p") aoa.push([plain(b.text)]);
      else if (b.type === "ul") b.items.forEach((it) => aoa.push([`- ${plain(it.text)}`]));
      else if (b.type === "ol") b.items.forEach((it, i) => aoa.push([`${i + 1}. ${plain(it.text)}`]));
      else if (b.type === "hr") aoa.push([""]);
    }
    if (aoa.length === 0) aoa.push([title]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, ws, "Isi");
  }

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], { type: MIME.xlsx });
}

// ---------- PowerPoint ----------

async function buildPptx(title: string, content: string): Promise<Blob> {
  // bundle browser pptxgenjs: tidak membutuhkan modul Node (fs/https)
  const mod = await import("pptxgenjs/dist/pptxgen.bundle.js");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PptxGenJS: any = (mod as any).default ?? mod;
  const { docTitle, blocks } = prepare(title, content);

  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625 inci
  pres.title = docTitle;

  const titleSlide = pres.addSlide();
  titleSlide.background = { color: BRAND };
  titleSlide.addText(docTitle, { x: 0.7, y: 1.7, w: 8.6, h: 1.4, fontSize: 36, bold: true, color: "FFFFFF", valign: "middle" });

  type Pending = { title: string; bullets: string[]; tables: Extract<Block, { type: "table" }>[] };
  let cur: Pending | null = null;
  const slides: Pending[] = [];
  let subtitleDone = false;

  for (const b of blocks) {
    if (b.type === "h" && b.level === 1) continue;
    if (b.type === "h") {
      cur = { title: plain(b.text), bullets: [], tables: [] };
      slides.push(cur);
      continue;
    }
    if (!cur) {
      // teks sebelum slide pertama dipakai sebagai subjudul slide judul
      if (b.type === "p" && !subtitleDone) {
        titleSlide.addText(plain(b.text), { x: 0.7, y: 3.2, w: 8.6, h: 1, fontSize: 18, color: "DDEFE8", valign: "top" });
        subtitleDone = true;
        continue;
      }
      cur = { title: docTitle, bullets: [], tables: [] };
      slides.push(cur);
    }
    if (b.type === "p") cur.bullets.push(plain(b.text));
    else if (b.type === "ul" || b.type === "ol") b.items.forEach((it) => cur!.bullets.push(plain(it.text)));
    else if (b.type === "table") cur.tables.push(b);
  }

  const MAX_BULLETS = 6;
  const addContentSlide = (heading: string, bullets: string[], tables: Pending["tables"]) => {
    const s = pres.addSlide();
    s.addText(heading, { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 28, bold: true, color: BRAND, valign: "middle" });
    s.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.12, w: 1.2, h: 0.06, fill: { color: BRAND }, line: { color: BRAND } });
    let top = 1.4;
    if (bullets.length) {
      const h = tables.length ? 1.8 : 3.8;
      s.addText(
        bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })),
        { x: 0.6, y: top, w: 8.8, h, fontSize: 18, color: "333333", valign: "top", paraSpaceAfter: 8, fit: "shrink" },
      );
      top += h + 0.1;
    }
    for (const t of tables) {
      const cols = Math.max(t.head?.length ?? 0, ...t.rows.map((r) => r.length), 1);
      const rows: { text: string; options?: Record<string, unknown> }[][] = [];
      if (t.head)
        rows.push(padRow(t.head, cols).map((c) => ({ text: plain(c), options: { bold: true, color: "FFFFFF", fill: { color: BRAND } } })));
      t.rows.forEach((r) => rows.push(padRow(r, cols).map((c) => ({ text: plain(c) }))));
      s.addTable(rows, {
        x: 0.6, y: top, w: 8.8, fontSize: 12, color: "333333",
        border: { type: "solid", pt: 1, color: "CCCCCC" }, valign: "middle",
      });
      top += 0.4 * rows.length + 0.2;
    }
  };

  for (const sl of slides) {
    if (sl.bullets.length <= MAX_BULLETS) {
      addContentSlide(sl.title, sl.bullets, sl.tables);
    } else {
      for (let i = 0; i < sl.bullets.length; i += MAX_BULLETS) {
        const first = i === 0;
        addContentSlide(first ? sl.title : `${sl.title} (lanjutan)`, sl.bullets.slice(i, i + MAX_BULLETS), first ? sl.tables : []);
      }
    }
  }
  if (slides.length === 0) addContentSlide(docTitle, [], []);

  const data = await pres.write({ outputType: "blob" });
  return data as Blob;
}

// ---------- API publik ----------

/** `opts.showTitle=false`: jangan tambahkan judul otomatis di atas isi (mis. untuk surat/cover letter). */
export async function buildFile(
  format: FileFormat,
  title: string,
  content: string,
  opts: { showTitle?: boolean } = {},
): Promise<{ blob: Blob; filename: string }> {
  const showTitle = opts.showTitle ?? true;
  const blob =
    format === "pdf" ? await buildPdf(title, content, showTitle)
    : format === "docx" ? await buildDocx(title, content, showTitle)
    : format === "xlsx" ? await buildXlsx(title, content)
    : await buildPptx(title, content);
  return { blob, filename: safeFilename(title, format) };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
