import type { ReactNode } from "react";
import { useGuideOptional } from "../hooks/useGuide";

interface GuideTriggerProps {
  guideId: string;
  children: ReactNode;
  className?: string;
}

export default function GuideTrigger({ guideId, children, className }: GuideTriggerProps) {
  const guide = useGuideOptional();

  return (
    <button
      type="button"
      className={className}
      onClick={() => guide?.startGuide(guideId)}
    >
      {children}
    </button>
  );
}
