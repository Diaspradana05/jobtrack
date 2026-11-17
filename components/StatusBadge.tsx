import { STATUS_LABEL, STATUS_STYLE, type Status } from "@/lib/types";

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[status] ?? "bg-stone-100"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
