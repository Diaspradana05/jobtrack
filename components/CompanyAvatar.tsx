const PALETTE = [
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
  "bg-teal-100 text-teal-800",
  "bg-orange-100 text-orange-800",
  "bg-indigo-100 text-indigo-800",
];

const SIZE = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-xl" } as const;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Lingkaran berisi inisial perusahaan; warnanya selalu sama untuk nama yang sama. */
export default function CompanyAvatar({ name, size = "md" }: { name: string; size?: keyof typeof SIZE }) {
  const initial = (name.trim().match(/[A-Za-z0-9]/)?.[0] ?? "?").toUpperCase();
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${SIZE[size]} ${PALETTE[hash(name.trim().toLowerCase()) % PALETTE.length]}`}
      aria-hidden
    >
      {initial}
    </span>
  );
}
