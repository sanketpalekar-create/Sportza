import { useContext } from "react";
import { GuideContext, type GuideContextValue } from "../components/GuideProvider";

export function useGuide(): GuideContextValue {
  const ctx = useContext(GuideContext);
  if (!ctx) {
    throw new Error("useGuide must be used within GuideProvider");
  }
  return ctx;
}

export function useGuideOptional(): GuideContextValue | null {
  return useContext(GuideContext);
}
