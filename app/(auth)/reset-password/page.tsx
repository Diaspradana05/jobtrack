import type { Metadata } from "next";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Atur password baru" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
