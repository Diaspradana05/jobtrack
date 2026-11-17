import { Fragment, type ReactNode } from "react";

/** Renderer markdown ringan (tanpa dependency): heading, list, tabel, garis, **tebal**, *miring*, `kode`, tautan, <br>. */

export type Item = { text: string; indent: number };
export type Block =
  | { type: "h"; level: number; text: string }
  | { type: "ul" | "ol"; items: Item[] }
  | { type: "p"; text: string }
  | { type: "hr" }
  | { type: "table"; head: string[] | null; rows: string[][] };

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

function buildTable(lines: string[]): Block {
  const rows = lines.map(splitRow);
  const isSep = rows.length >= 2 && rows[1].every((c) => /^:?-{2,}:?$/.test(c));
  return isSep ? { type: "table", head: rows[0], rows: rows.slice(2) } : { type: "table", head: null, rows };
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: Item[] } | null = null;
  let table: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push({ type: "p", text: para.join("\n") });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };
  const flushTable = () => {
    if (table.length) blocks.push(buildTable(table));
    table = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (/^\s*\|/.test(line)) {
      flushPara();
      flushList();
      table.push(line);
      continue;
    }
    flushTable();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushPara();
      flushList();
      blocks.push({ type: "hr" });
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ type: "h", level: h[1].length, text: h[2] });
      continue;
    }
    const ul = /^(\s*)[-*•]\s+(.*)$/.exec(line);
    const ol = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const m = (ul ?? ol)!;
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push({ text: m[2], indent: m[1].length >= 2 ? 1 : 0 });
      continue;
    }
    if (list && /^\s+\S/.test(raw)) {
      // lanjutan baris dari item list sebelumnya
      list.items[list.items.length - 1].text += " " + line.trim();
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  flushTable();
  return blocks;
}

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)|\*[^*\s][^*\n]*\*)/g;

function inlineOne(text: string, keyBase: string): ReactNode[] {
  return text.split(INLINE).map((p, i) => {
    const key = `${keyBase}-${i}`;
    if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) return <strong key={key}>{inlineOne(p.slice(2, -2), key)}</strong>;
    if (p.length > 2 && p.startsWith("`") && p.endsWith("`"))
      return (
        <code key={key} className="rounded bg-stone-200/70 px-1 py-0.5 text-[0.85em]">
          {p.slice(1, -1)}
        </code>
      );
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(p);
    if (link)
      return (
        <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-brand underline">
          {link[1]}
        </a>
      );
    if (p.length > 2 && p.startsWith("*") && p.endsWith("*")) return <em key={key}>{p.slice(1, -1)}</em>;
    return <Fragment key={key}>{p}</Fragment>;
  });
}

/** Teks inline; tag <br> dari AI diubah jadi baris baru sungguhan. */
function inline(text: string): ReactNode[] {
  return text.split(/<br\s*\/?>/i).flatMap((part, i) => {
    const nodes = inlineOne(part.trim(), `s${i}`);
    return i === 0 ? nodes : [<br key={`br${i}`} />, ...nodes];
  });
}

export default function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parseMarkdown(text);
  return (
    <div className={`space-y-2.5 ${className}`}>
      {blocks.map((b, i) => {
        if (b.type === "h")
          return (
            <p key={i} className={b.level <= 2 ? "text-base font-bold" : "font-bold"}>
              {inline(b.text)}
            </p>
          );
        if (b.type === "hr") return <hr key={i} className="border-stone-300" />;
        if (b.type === "table")
          return (
            <div key={i} className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
              <table className="w-full border-collapse text-left text-[0.92em]">
                {b.head && (
                  <thead className="bg-stone-50">
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j} className="border-b border-stone-200 px-3 py-2 align-top font-semibold">
                          {inline(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j} className="border-t border-stone-100 first:border-t-0">
                      {r.map((c, k) => (
                        <td key={k} className="px-3 py-2 align-top">
                          {inline(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        if (b.type === "p")
          return (
            <p key={i} className="whitespace-pre-wrap">
              {inline(b.text)}
            </p>
          );
        const Tag = b.type;
        return (
          <Tag key={i} className={`space-y-1 pl-5 ${b.type === "ul" ? "list-disc" : "list-decimal"}`}>
            {b.items.map((it, j) => (
              <li key={j} style={it.indent ? { marginLeft: "1rem" } : undefined}>
                {inline(it.text)}
              </li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}
