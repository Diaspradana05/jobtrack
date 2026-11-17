import type { Metadata } from "next";
import CvClient from "@/components/CvClient";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "CV & Match" };

export default async function CvPage() {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("cv_documents")
    .select("file_name, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return <CvClient current={doc ? { fileName: doc.file_name, createdAt: doc.created_at } : null} />;
}
