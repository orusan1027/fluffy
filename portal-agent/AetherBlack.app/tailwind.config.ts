import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        aether: {
          bg: "#000000",
          card: "#111111",
          border: "#222222",
          accent: "#4ade80", // green-400
          muted: "#6b7280",  // gray-500
          error: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};

export default config;
