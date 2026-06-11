import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#f5f5f7",
        graphite: "#1d1d1f",
        titanium: "#86868b",
        panel: "rgba(255,255,255,0.075)",
        line: "rgba(255,255,255,0.13)",
        mint: "#5df2b6",
        blue: "#6aa8ff",
        amber: "#ffd166",
        rose: "#ff6b8a",
      },
      boxShadow: {
        glow: "0 24px 80px rgba(0,0,0,0.45)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
