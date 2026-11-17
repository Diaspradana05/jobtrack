export interface BarItem {
  label: string;
  value: number;
  className?: string;
}

export default function BarList({ items }: { items: BarItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-stone-600">{i.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-stone-100">
            <div
              className={`h-full rounded-full transition-all duration-700 ${i.className ?? "bg-brand"}`}
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </div>
          <span className="w-6 text-right font-semibold">{i.value}</span>
        </div>
      ))}
    </div>
  );
}
