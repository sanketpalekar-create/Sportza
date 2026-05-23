import type { Config } from "tailwindcss";
import { sportzaTailwindTheme } from "@sportza/tokens/tailwind";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: sportzaTailwindTheme,
  },
  plugins: [],
};

export default config;
