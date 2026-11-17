import type { Metadata } from "next";
import ApplicationsClient from "@/components/ApplicationsClient";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_LIST_COLUMNS, type Application } from "@/lib/types";
import type { Schedule } from "@/lib/schedule";

export const metadata: Metadata = { title: "Applications" };

export default async function ApplicationsPage() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(APPLICATION_LIST_COLUMNS)
    .order("created_at", { ascending: false });
  // gagal dengan jelas (ditangkap error.tsx) daripada menampilkan daftar kosong yang menyesatkan
  if (error) throw new Error(`Gagal memuat lamaran: ${error.message}`);

  // jadwal/pengingat; kosong bila tabel schedules belum dibuat
  const { data: schedules } = await supabase.from("schedules").select("*").order("due_date").limit(500);

  return <ApplicationsClient apps={(data ?? []) as Application[]} schedules={(schedules ?? []) as Schedule[]} />;
}
