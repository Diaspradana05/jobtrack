import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <AuthForm
      mode="login"
      notice={searchParams.error === "link" ? "Tautan dari email tidak valid atau sudah kedaluwarsa. Silakan masuk, atau minta tautan baru." : undefined}
    />
  );
}
