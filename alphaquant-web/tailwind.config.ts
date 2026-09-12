import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#08090d",
        surface: {
          50: "#1b1e2e",
          100: "#151824",
          200: "#10121c",
          300: "#0c0e15",
        },
        border: "#1e2235",
        primary: {
          DEFAULT: "#06b6d4",
          foreground: "#042f2e",
          glow: "rgba(6, 182, 212, 0.15)",
        },
        profit: {
          DEFAULT: "#10b981",
          foreground: "#022c22",
          muted: "rgba(16, 185, 129, 0.12)",
        },
        loss: {
          DEFAULT: "#f43f5e",
          foreground: "#4c0519",
          muted: "rgba(244, 63, 94, 0.12)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
