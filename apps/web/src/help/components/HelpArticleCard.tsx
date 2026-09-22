import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { articlePath } from "../content/registry";
import type { HelpArticle } from "../content/types";

export default function HelpArticleCard({ article }: { article: HelpArticle }) {
  return (
    <Link
      to={articlePath(article)}
      className="flex items-start gap-3 rounded-xl px-4 py-3.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      style={{
        backgroundColor: "rgba(30,41,59,0.7)",
        border: "1px solid rgba(148,163,184,0.1)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>
          {article.title}
        </p>
        <p className="mt-1 text-xs leading-relaxed line-clamp-2" style={{ color: "#94A3B8" }}>
          {article.description}
        </p>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0" style={{ color: "#475569" }} aria-hidden />
    </Link>
  );
}
