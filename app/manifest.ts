import type { MetadataRoute } from "next";

/** Manifest agar JobTrack bisa dipasang di layar utama ponsel (PWA dasar). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JobTrack",
    short_name: "JobTrack",
    description: "Lacak lamaran kerja dan magang dengan bantuan AI.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F6F5F1",
    theme_color: "#0B6B4F",
    lang: "id",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
