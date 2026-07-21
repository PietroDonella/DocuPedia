import type { Config } from "tailwindcss";

const config: Config = {
  // Dark mode controlado por classe (`.dark` no <html>), alternada pelo slider.
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta minimalista, focada em leitura confortável.
        ink: {
          DEFAULT: "#1a1a1a",
          soft: "#404040",
          muted: "#6b7280",
        },
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#fafafa",
          border: "#e8e8e8",
        },
        accent: {
          DEFAULT: "#4f46e5",
          soft: "#eef2ff",
        },
      },
      fontFamily: {
        // Tipografia clara priorizando legibilidade de textos longos.
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["Georgia", "Cambria", "serif"],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "72ch",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
