import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useGuideOptional } from "../hooks/useGuide";
import { getGuide } from "../definitions/registry";

interface GuideTriggerProps {
  guideId: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Navigate here before starting the guide (e.g. home for dashboard tours). */
  navigateTo?: string;
}

/** Default routes for guides that are not first_visit-bound. */
const GUIDE_ROUTES: Record<string, string> = {
  welcome: "/",
  dashboard: "/",
  "venue-booking": "/venues",
  "open-play": "/open-plays",
  training: "/training",
  match: "/matches",
  stats: "/stats",
  tournament: "/tournaments",
};

export default function GuideTrigger({
  guideId,
  children,
  className,
  style,
  navigateTo,
}: GuideTriggerProps) {
  const guide = useGuideOptional();
  const navigate = useNavigate();

  const handleClick = () => {
    if (!guide) return;
    const def = getGuide(guideId);
    if (!def) return;

    const dest =
      navigateTo ??
      GUIDE_ROUTES[guideId] ??
      (def.trigger.type === "first_visit" && def.trigger.route
        ? def.trigger.route
        : undefined);

    if (dest) {
      const current = window.location.pathname.replace(/\/$/, "") || "/";
      const target = dest.replace(/\/$/, "") || "/";
      if (current !== target) {
        navigate(dest);
        // Allow the destination page to mount targets before starting
        window.setTimeout(() => guide.startGuide(guideId), 350);
        return;
      }
    }
    guide.startGuide(guideId);
  };

  return (
    <button type="button" className={className} style={style} onClick={handleClick}>
      {children}
    </button>
  );
}
