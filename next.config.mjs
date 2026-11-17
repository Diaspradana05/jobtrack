/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  experimental: {
    // Data selalu diambil ulang saat pindah halaman, jadi perubahan dari AI agent langsung terlihat.
    staleTimes: { dynamic: 0, static: 30 },
    // Mengaktifkan instrumentation.ts (penjadwal pengingat email untuk mode lokal). Di Next.js 15 ke atas ini sudah bawaan.
    instrumentationHook: true,
    // Pembaca lampiran (Word/Excel) dimuat langsung dari node_modules di server, tidak ikut dibundel.
    serverComponentsExternalPackages: ["mammoth", "xlsx"],
  },
  // Library pembuat file (xlsx dll.) memuat modul Node secara opsional; di browser tidak dipakai.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, https: false, http: false };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // mikrofon diizinkan untuk dikte jawaban di simulasi interview
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
