import { PropsWithChildren, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient } from "./queryClient";
import { ThemeProvider } from "./ThemeProvider";
import { initializeApiClient } from "../lib/apiClient";

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    initializeApiClient();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
