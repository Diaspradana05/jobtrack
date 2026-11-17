import type { Metadata } from "next";
import { notFound } from "next/navigation";
import InterviewClient from "@/components/InterviewClient";
import { rowToSession } from "@/lib/interview";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Simulasi interview" };

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  // select("*") agar tidak gagal bila kolom job_description belum dimigrasikan
  const { data: app } = await supabase.from("applications").select("*").eq("id", params.id).maybeSingle();
  if (!app) notFound();

  const [sessionsRes, { count: cvCount }] = await Promise.all([
    supabase
      .from("interview_sessions")
      .select("id, application_id, mode, total_questions, status, turns, report, avg_score, created_at, finished_at")
      .eq("application_id", params.id)
      .order("created_at", { ascending: false }),
    supabase.from("cv_documents").select("id", { count: "exact", head: true }),
  ]);

  return (
    <InterviewClient
      app={{ id: app.id, company: app.company, position: app.position }}
      sessions={(sessionsRes.data ?? []).map(rowToSession)}
      hasCv={(cvCount ?? 0) > 0}
      jdReady={((app.job_description as string | null) ?? "").trim().length >= 30}
      tableReady={!sessionsRes.error}
    />
  );
}
