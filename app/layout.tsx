import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "JobTrack - AI Job Application Tracker", template: "%s · JobTrack" },
  description: "Lacak lamaran kerja dan magang, jadwalkan interview, dan berlatih dengan bantuan AI.",
  applicationName: "JobTrack",
  openGraph: {
    title: "JobTrack - AI Job Application Tracker",
    description: "Lacak lamaran kerja dan magang, jadwalkan interview, dan berlatih dengan bantuan AI.",
    type: "website",
    locale: "id_ID",
    siteName: "JobTrack",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B6B4F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${jakarta.variable} font-sans`}>{children}</body>
    </html>
  );
}
