import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Galaxy-matching palette
        brand: {
          purple: "#7C3AED",
          "purple-light": "#A78BFA",
          "purple-dark": "#5B21B6",
        },
        canvas: {
          bg: "#0F0F13",
          grid: "#1A1A24",
          card: "#16161F",
          border: "#2A2A3A",
          "border-hover": "#3D3D55",
        },
        handle: {
          text: "#F97316",      // orange
          image: "#3B82F6",     // blue
          video: "#22C55E",     // green
          audio: "#06B6D4",     // cyan
          file: "#A855F7",      // purple
          number: "#EC4899",    // pink
        },
        status: {
          running: "#7C3AED",
          success: "#22C55E",
          failed: "#EF4444",
          skipped: "#6B7280",
        },
      },
      animation: {
        "glow-pulse": "glow-pulse 1.5s ease-in-out infinite",
        "dash-flow": "dash-flow 1.5s linear infinite",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 8px 2px rgba(124, 58, 237, 0.4)",
          },
          "50%": {
            boxShadow: "0 0 20px 6px rgba(124, 58, 237, 0.8)",
          },
        },
        "dash-flow": {
          "0%": { strokeDashoffset: "24" },
          "100%": { strokeDashoffset: "0" },
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
