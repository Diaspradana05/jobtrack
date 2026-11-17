import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0B6B4F", dark: "#084F3A", soft: "#E3F1EB" },
        paper: "#F6F5F1",
        ink: "#16211C",
      },
      fontFamily: { sans: ["var(--font-jakarta)", "system-ui", "sans-serif"] },
      boxShadow: {
        soft: "0 1px 2px rgba(22,33,28,.04), 0 6px 20px -8px rgba(22,33,28,.08)",
        lift: "0 2px 4px rgba(22,33,28,.05), 0 14px 30px -10px rgba(22,33,28,.16)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        pop: { from: { opacity: "0", transform: "scale(.97)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "fade-in": "fade-in .35s ease-out both",
        pop: "pop .2s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
