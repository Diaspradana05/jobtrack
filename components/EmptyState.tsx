import type { LucideIcon } from "lucide-react";

/** Tampilan kosong yang ramah: ikon, judul, penjelasan, dan (opsional) tombol aksi. */
export default function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-stone-500">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
