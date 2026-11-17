import type { Metadata } from "next";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Lupa password" };

export default function ForgotPasswordPage({ searchParams }: { searchParams: { error?: string } }) {
  return <ForgotPasswordForm linkError={searchParams.error === "link"} />;
}
