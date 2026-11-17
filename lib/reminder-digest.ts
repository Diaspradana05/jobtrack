import { KIND_SHORT, formatDue, relativeLabel, sortSchedules, urgency, type Now, type Schedule } from "@/lib/schedule";

/** Penyusun isi email ringkasan agenda. Murni (tanpa I/O) supaya mudah diuji. */

export interface Digest {
  subject: string;
  html: string;
  text: string;
  counts: { overdue: number; today: number; upcoming: number; total: number };
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const SECTION = {
  overdue: { title: "Terlambat", color: "#be123c", bg: "#fff1f2" },
  today: { title: "Hari ini", color: "#b45309", bg: "#fffbeb" },
  upcoming: { title: "Segera", color: "#0f6e56", bg: "#ecf6f2" },
} as const;

type Group = keyof typeof SECTION;

const titleOf = (s: Schedule) =>
  `${KIND_SHORT[s.kind]}${s.applications ? ` · ${s.applications.position} di ${s.applications.company}` : ""}`;

export function buildDigest(items: Schedule[], now: Now, opts: { appUrl: string }): Digest {
  const pending = items.filter((s) => !s.done).sort(sortSchedules);
  const groups: Record<Group, Schedule[]> = { overdue: [], today: [], upcoming: [] };
  for (const s of pending) {
    const u = urgency(s, now);
    groups[u === "overdue" ? "overdue" : u === "today" ? "today" : "upcoming"].push(s);
  }
  const counts = {
    overdue: groups.overdue.length,
    today: groups.today.length,
    upcoming: groups.upcoming.length,
    total: pending.length,
  };

  let subject: string;
  if (counts.total === 0) subject = "Pengingat JobTrack: tidak ada jadwal mendatang";
  else if (counts.total === 1) subject = `Pengingat: ${titleOf(pending[0])} (${relativeLabel(pending[0], now)})`;
  else {
    const parts = [
      counts.overdue && `${counts.overdue} terlambat`,
      counts.today && `${counts.today} hari ini`,
      counts.upcoming && `${counts.upcoming} segera`,
    ].filter(Boolean);
    subject = `Pengingat JobTrack: ${parts.join(", ")}`;
  }

  const agendaUrl = `${opts.appUrl.replace(/\/$/, "")}/agenda`;

  const rowHtml = (s: Schedule, g: Group) => `
    <tr><td style="padding:10px 14px;border-top:1px solid #eee;font-size:14px;line-height:1.5;color:#1c1917;">
      <div style="font-weight:600;">${escapeHtml(titleOf(s))}</div>
      <div style="color:#57534e;font-size:13px;">${escapeHtml(formatDue(s))}${s.note ? ` &middot; ${escapeHtml(s.note)}` : ""}</div>
      <div style="margin-top:4px;"><span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;font-weight:600;background:${SECTION[g].bg};color:${SECTION[g].color};">${escapeHtml(relativeLabel(s, now))}</span></div>
    </td></tr>`;

  const sectionHtml = (g: Group) =>
    groups[g].length === 0
      ? ""
      : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid #e7e5e4;border-radius:12px;border-left:4px solid ${SECTION[g].color};overflow:hidden;">
      <tr><td style="padding:10px 14px;font-weight:700;font-size:14px;color:${SECTION[g].color};">${SECTION[g].title} (${groups[g].length})</td></tr>
      ${groups[g].map((s) => rowHtml(s, g)).join("")}
    </table>`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px 12px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;padding:24px;">
      <tr><td>
        <div style="font-size:20px;font-weight:800;color:#0f6e56;">JobTrack</div>
        <div style="margin-top:4px;font-size:15px;color:#44403c;">${
          counts.total === 0 ? "Tidak ada jadwal yang perlu diperhatikan dalam waktu dekat." : "Ringkasan agenda lamaran kerja Anda:"
        }</div>
        ${sectionHtml("overdue")}${sectionHtml("today")}${sectionHtml("upcoming")}
        <div style="margin-top:22px;"><a href="${escapeHtml(agendaUrl)}" style="display:inline-block;background:#0f6e56;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:99px;font-size:14px;font-weight:600;">Buka Agenda</a></div>
        <div style="margin-top:20px;font-size:12px;color:#a8a29e;">Anda menerima email ini karena pengingat email diaktifkan di JobTrack. Matikan kapan saja di halaman Agenda.</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const textSection = (g: Group) =>
    groups[g].length === 0
      ? ""
      : `${SECTION[g].title.toUpperCase()} (${groups[g].length})\n${groups[g]
          .map((s) => `- ${titleOf(s)}\n  ${formatDue(s)}${s.note ? ` | ${s.note}` : ""} [${relativeLabel(s, now)}]`)
          .join("\n")}\n`;

  const text =
    `JobTrack - ringkasan agenda\n\n` +
    (counts.total === 0
      ? "Tidak ada jadwal yang perlu diperhatikan dalam waktu dekat.\n"
      : [textSection("overdue"), textSection("today"), textSection("upcoming")].filter(Boolean).join("\n")) +
    `\nBuka Agenda: ${agendaUrl}\n`;

  return { subject, html, text, counts };
}
