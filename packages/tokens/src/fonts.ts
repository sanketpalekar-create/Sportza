export const fontFamilies: { sans: string[]; mono: string[] } = {
  sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
};

export const fontSizes: Record<string, [string, { lineHeight: string }]> = {
  xs: ["0.75rem", { lineHeight: "1rem" }],
  sm: ["0.875rem", { lineHeight: "1.25rem" }],
  base: ["1rem", { lineHeight: "1.5rem" }],
  lg: ["1.125rem", { lineHeight: "1.75rem" }],
  xl: ["1.25rem", { lineHeight: "1.75rem" }],
  "2xl": ["1.5rem", { lineHeight: "2rem" }],
  "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
  "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
};

export const fontWeights: Record<string, string> = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
};

export type FontFamilies = typeof fontFamilies;
export type FontSizes = typeof fontSizes;
export type FontWeights = typeof fontWeights;
