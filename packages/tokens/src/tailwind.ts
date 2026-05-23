import { colors } from "./colors";
import { spacing } from "./spacing";
import { radii } from "./radii";
import { fontFamilies, fontSizes, fontWeights } from "./fonts";
import { shadows } from "./shadows";

export const sportzaTailwindTheme = {
  colors: {
    primary: colors.primary,
    secondary: colors.secondary,
    surface: colors.surface,
    text: colors.text,
    border: colors.border,
    status: colors.status,
    sport: colors.sport,
  },
  spacing,
  borderRadius: radii,
  fontFamily: fontFamilies,
  fontSize: fontSizes,
  fontWeight: fontWeights,
  boxShadow: shadows,
} as const;

export { colors, spacing, radii, fontFamilies, fontSizes, fontWeights, shadows };
