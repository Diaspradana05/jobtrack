// Dirender ulang di setiap pindah halaman, sehingga transisi masuk selalu terjadi.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
