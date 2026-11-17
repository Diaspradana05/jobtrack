// Dijalankan Next.js sekali saat server dimulai. Mengaktifkan penjadwal pengingat email untuk mode lokal.
// Kode Node dipisah ke instrumentation-node.ts supaya tidak ikut dibundel untuk runtime Edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    registerNode();
  }
}
