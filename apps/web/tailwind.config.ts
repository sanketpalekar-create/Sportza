import type { Config } from "tailwindcss";
import { sportzaTailwindTheme } from "@sportza/tokens/tailwind";

// Helper: reference a CSS variable as an RGB colour token so Tailwind's
// opacity modifier (e.g. bg-surface/50) works correctly.
const cssVar = (name: string) =>
  `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Spread all token values (spacing, radii, fonts, shadows, sport colours…)
      ...sportzaTailwindTheme,
      colors: {
        // Keep primary, secondary, status, sport from tokens
        ...sportzaTailwindTheme.colors,
        // Override semantic surfaces/text/border with CSS-variable references
        // so they flip automatically when the `dark` class is toggled.
        surface: {
          DEFAULT:  cssVar("--color-surface"),
          secondary: cssVar("--color-surface-secondary"),
          tertiary:  cssVar("--color-surface-tertiary"),
          elevated:  cssVar("--color-surface-elevated"),
          overlay:   "rgba(0,0,0,0.5)",
        },
        text: {
          primary:   cssVar("--color-text-primary"),
          secondary: cssVar("--color-text-secondary"),
          tertiary:  cssVar("--color-text-tertiary"),
          inverse:   cssVar("--color-text-inverse"),
          link:      cssVar("--color-text-link"),
        },
        border: {
          DEFAULT: cssVar("--color-border"),
          light:   cssVar("--color-border-light"),
          focus:   cssVar("--color-border-focus"),
        },
      },
    },
  },
  plugins: [],
};

export default config;
