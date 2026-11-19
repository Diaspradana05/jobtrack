"use client";

// Menangkap error di layout paling atas (di luar grup (app)); wajib membawa <html> dan <body> sendiri.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F6F5F1", color: "#16211C" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Terjadi kesalahan</h1>
          <p style={{ maxWidth: 360, margin: 0, color: "#57534e", fontSize: 14 }}>
            Aplikasi gagal dimuat. Coba muat ulang halaman.
            {error.digest ? ` (kode: ${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 8, border: 0, borderRadius: 999, background: "#0B6B4F", color: "#fff", padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}
          >
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
