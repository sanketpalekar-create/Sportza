import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, ThumbsDown, ThumbsUp } from "lucide-react";
import HelpArticleCard from "../../help/components/HelpArticleCard";
import {
  articlePath,
  estimateReadingMinutes,
  getArticle,
  getArticlesByCategory,
  getRelatedArticles,
} from "../../help/content/registry";
import { trackProductEvent } from "../../guide/analytics";

export default function HelpArticlePage() {
  const { category: categorySlug = "", slug = "" } = useParams();
  const article = getArticle(slug);
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    if (article) {
      trackProductEvent("help_article_opened", {
        articleId: article.id,
        slug: article.slug,
        category: article.category,
      });
    }
  }, [article?.id]);

  const related = useMemo(() => (article ? getRelatedArticles(article) : []), [article]);
  const siblings = useMemo(() => {
    if (!article) return { prev: null, next: null };
    const list = getArticlesByCategory(article.category);
    const idx = list.findIndex((a) => a.id === article.id);
    return {
      prev: idx > 0 ? list[idx - 1] : null,
      next: idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null,
    };
  }, [article]);

  if (!article || (categorySlug && article.category !== categorySlug)) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm" style={{ color: "#E2E8F0" }}>
          Article not found.
        </p>
        <Link to="/help" className="mt-3 inline-block text-sm font-semibold text-blue-400">
          Back to Help Center
        </Link>
      </div>
    );
  }

  const minutes = estimateReadingMinutes(article);
  const toc = article.content.sections.filter((s) => s.heading);

  const sendFeedback = (value: "yes" | "no") => {
    setFeedback(value);
    trackProductEvent(value === "yes" ? "help_article_helpful" : "help_article_not_helpful", {
      articleId: article.id,
    });
  };

  return (
    <article className="px-4 pb-10 pt-2">
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs" aria-label="Breadcrumb">
        <Link to="/help" className="inline-flex items-center gap-1 font-medium text-blue-400">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Help
        </Link>
        <span style={{ color: "#475569" }}>/</span>
        <Link to={`/help/${article.category}`} className="capitalize text-blue-400">
          {article.category.replace(/-/g, " ")}
        </Link>
        <span style={{ color: "#475569" }}>/</span>
        <span className="line-clamp-1" style={{ color: "#94A3B8" }}>
          {article.title}
        </span>
      </nav>

      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#3B82F6" }}>
        {article.category.replace(/-/g, " ")}
      </p>
      <h1 className="mt-1 text-2xl font-bold leading-tight" style={{ color: "#F8FAFC" }}>
        {article.title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
        {article.description}
      </p>
      <p className="mt-2 text-xs" style={{ color: "#64748B" }}>
        {minutes} min read
      </p>

      {toc.length > 1 && (
        <nav
          className="mt-5 rounded-xl p-4"
          aria-label="Table of contents"
          style={{
            backgroundColor: "rgba(30,41,59,0.7)",
            border: "1px solid rgba(148,163,184,0.12)",
          }}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#64748B" }}>
            On this page
          </p>
          <ul className="flex flex-col gap-1.5">
            {toc.map((section) => (
              <li key={section.heading}>
                <a
                  href={`#${slugify(section.heading!)}`}
                  className="text-sm text-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  {section.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {article.content.sections.map((section, i) => (
          <section key={i} id={section.heading ? slugify(section.heading) : undefined}>
            {section.heading && (
              <h2 className="mb-2 text-base font-semibold" style={{ color: "#F1F5F9" }}>
                {section.heading}
              </h2>
            )}
            <p className="text-sm leading-relaxed" style={{ color: "#CBD5E1" }}>
              {section.body}
            </p>
            {section.tip && (
              <p
                className="mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed"
                style={{
                  backgroundColor: "rgba(59,130,246,0.1)",
                  color: "#93C5FD",
                  border: "1px solid rgba(59,130,246,0.2)",
                }}
              >
                Tip: {section.tip}
              </p>
            )}
          </section>
        ))}
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold" style={{ color: "#CBD5E1" }}>
            Related articles
          </h2>
          <div className="flex flex-col gap-2">
            {related.map((a) => (
              <HelpArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}

      <section
        className="mt-10 rounded-xl p-4"
        style={{
          backgroundColor: "rgba(30,41,59,0.8)",
          border: "1px solid rgba(148,163,184,0.12)",
        }}
      >
        <p className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>
          Was this helpful?
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => sendFeedback("yes")}
            disabled={feedback !== null}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60"
            style={{
              backgroundColor: feedback === "yes" ? "rgba(34,197,94,0.2)" : "rgba(15,23,42,0.8)",
              color: "#E2E8F0",
              border: "1px solid rgba(148,163,184,0.2)",
            }}
          >
            <ThumbsUp className="h-4 w-4" aria-hidden />
            Yes
          </button>
          <button
            type="button"
            onClick={() => sendFeedback("no")}
            disabled={feedback !== null}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60"
            style={{
              backgroundColor: feedback === "no" ? "rgba(239,68,68,0.2)" : "rgba(15,23,42,0.8)",
              color: "#E2E8F0",
              border: "1px solid rgba(148,163,184,0.2)",
            }}
          >
            <ThumbsDown className="h-4 w-4" aria-hidden />
            No
          </button>
        </div>
        {feedback && (
          <p className="mt-2 text-xs" style={{ color: "#94A3B8" }}>
            Thanks for your feedback.
          </p>
        )}
      </section>

      <section className="mt-6 text-center">
        <p className="text-sm" style={{ color: "#94A3B8" }}>
          Still need help?
        </p>
        <a
          href="mailto:support@sportza.in?subject=Sportza%20Support"
          className="mt-2 inline-block text-sm font-semibold text-blue-400"
        >
          Contact Support
        </a>
      </section>

      <nav className="mt-8 flex justify-between gap-3 text-sm" aria-label="Article navigation">
        {siblings.prev ? (
          <Link to={articlePath(siblings.prev)} className="font-medium text-blue-400">
            ← {siblings.prev.title}
          </Link>
        ) : (
          <span />
        )}
        {siblings.next ? (
          <Link to={articlePath(siblings.next)} className="text-right font-medium text-blue-400">
            {siblings.next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
