import { createContext, PropsWithChildren, useContext } from "react";
import { AppTheme, theme } from "../theme/theme";

const ThemeContext = createContext<AppTheme>(theme);

export function ThemeProvider({ children }: PropsWithChildren) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
