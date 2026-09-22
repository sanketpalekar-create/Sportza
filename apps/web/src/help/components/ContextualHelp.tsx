import { Link } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { Popover } from "@sportza/ui";
import { getArticle, articlePath } from "../content/registry";

interface ContextualHelpProps {
  articleId: string;
  label?: string;
  placement?: "top" | "bottom" | "left" | "right";
}

export default function ContextualHelp({
  articleId,
  label = "What is this?",
  placement = "top",
}: ContextualHelpProps) {
  const article = getArticle(articleId);
  if (!article) return null;

  return (
    <Popover
      placement={placement}
      label={label}
      trigger={
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full"
          style={{
            backgroundColor: "rgba(59,130,246,0.15)",
            color: "#60A5FA",
          }}
          aria-label={label}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
      }
      content={
        <div className="space-y-2">
          <p className="text-sm font-semibold text-text-primary">{article.title}</p>
          <p className="text-xs leading-relaxed text-text-secondary">{article.description}</p>
          <Link
            to={articlePath(article)}
            className="inline-block text-xs font-semibold text-primary-500"
          >
            Learn more
          </Link>
        </div>
      }
    />
  );
}
