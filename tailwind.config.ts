import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF7F2",
        ivory: "#FFFDFA",
        blush: {
          50: "#FDF4F2",
          100: "#F8E7E2",
          200: "#F0D2CA",
          300: "#E4B6AC",
          400: "#D69A8E",
          500: "#C48074",
        },
        sage: {
          100: "#EDF1EA",
          200: "#D7E0D1",
          300: "#B6C4AD",
          400: "#94A889",
          500: "#75886B",
        },
        gold: {
          300: "#E3CDA0",
          400: "#CFAE73",
          500: "#B4914F",
        },
        ink: {
          400: "#8A817B",
          600: "#5B534E",
          800: "#38312D",
          900: "#241F1C",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(56,49,45,0.06), 0 12px 32px -8px rgba(56,49,45,0.10)",
        lift: "0 4px 12px -4px rgba(56,49,45,0.10), 0 24px 48px -12px rgba(56,49,45,0.16)",
        inner_soft: "inset 0 1px 2px rgba(255,255,255,0.9)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.4s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
