import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { nowWib } from "@/lib/schedule";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // jumlah jadwal yang perlu perhatian (terlambat atau jatuh tempo hari ini); 0 bila tabel belum dibuat
  const { count } = await supabase
    .from("schedules")
    .select("id", { count: "exact", head: true })
    .eq("done", false)
    .lte("due_date", nowWib().date);

  return (
    <div className="min-h-screen md:flex">
      <Sidebar email={user.email ?? ""} agendaCount={count ?? 0} />
      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 md:p-8">{children}</main>
    </div>
  );
}
