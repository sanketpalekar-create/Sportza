import { Link } from "react-router-dom";
import {
  Rocket,
  MapPin,
  Calendar,
  Zap,
  Dumbbell,
  Target,
  BarChart3,
  Trophy,
  CreditCard,
  Star,
  Bell,
  User,
  Wrench,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import type { HelpCategory } from "../content/types";

const ICONS: Record<string, LucideIcon> = {
  Rocket,
  MapPin,
  Calendar,
  Zap,
  Dumbbell,
  Target,
  BarChart3,
  Trophy,
  CreditCard,
  Star,
  Bell,
  User,
  Wrench,
  HelpCircle,
};

export default function HelpCategoryCard({ category }: { category: HelpCategory }) {
  const Icon = ICONS[category.icon] ?? HelpCircle;

  return (
    <Link
      to={`/help/${category.slug}`}
      className="flex flex-col gap-2 rounded-xl p-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      style={{
        backgroundColor: "rgba(30,41,59,0.85)",
        border: "1px solid rgba(148,163,184,0.12)",
      }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: "rgba(59,130,246,0.12)" }}
      >
        <Icon className="h-4 w-4" style={{ color: "#3B82F6" }} aria-hidden />
      </div>
      <h3 className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>
        {category.title}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>
        {category.description}
      </p>
    </Link>
  );
}
