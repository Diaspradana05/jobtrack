import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ApplicationDetailClient from "@/components/ApplicationDetailClient";
import { createClient } from "@/lib/supabase/server";
import type { Schedule } from "@/lib/schedule";
import type { Application } from "@/lib/types";

export const metadata: Metadata = { title: "Detail lamaran" };

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  // id yang bukan UUID atau bukan milik pengguna (RLS) -> data kosong -> 404
  const { data: app } = await supabase.from("applications").select("*").eq("id", params.id).maybeSingle();
  if (!app) notFound();

  const [{ data: schedules }, { count: cvCount }] = await Promise.all([
    supabase.from("schedules").select("*").eq("application_id", params.id).order("due_date"),
    supabase.from("cv_documents").select("id", { count: "exact", head: true }),
  ]);

  return (
    <ApplicationDetailClient
      app={app as Application}
      schedules={(schedules ?? []) as Schedule[]}
      hasCv={(cvCount ?? 0) > 0}
      // kolom detail ada hanya bila migrasi sudah dijalankan
      detailReady={Object.prototype.hasOwnProperty.call(app, "job_description")}
    />
  );
}
