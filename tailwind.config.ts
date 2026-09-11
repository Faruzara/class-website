import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // -- Palet warna utama web kelas --
      colors: {
        brand: {
          50:  "#fff5f3",
          100: "#ffe7e3",
          200: "#fdcfca",
          400: "#f39a95",
          500: "#F17D78",   // coral accent
          600: "#dc645f",
          700: "#b94d49",
          900: "#682c2a",
        },
        surface: {
          base: "#ffffff",  // background utama
          card: "#ffffff",  // kartu
          muted: "#f5f3ef", // elemen sekunder
          border: "#e7e4de",
        },
        accent: {
          cyan:   "#22d3ee",
          purple: "#a78bfa",
          rose:   "#fb7185",
        },
      },
      fontFamily: {
        display: ["'Segoe UI'", "Arial", "system-ui", "sans-serif"],
        body:    ["'Segoe UI'", "Arial", "system-ui", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        xl:  "1rem",
        "2xl": "1.25rem",
      },
      animation: {
        "fade-up":    "fadeUp 0.5s ease forwards",
        "pulse-slow": "pulse 3s infinite",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
