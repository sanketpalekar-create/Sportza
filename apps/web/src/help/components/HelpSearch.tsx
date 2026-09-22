import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { articlePath, searchArticles } from "../content/registry";
import { trackProductEvent } from "../../guide/analytics";
import type { HelpArticle } from "../content/types";

interface HelpSearchProps {
  autoFocus?: boolean;
  onResultSelect?: () => void;
}

export default function HelpSearch({ autoFocus, onResultSelect }: HelpSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HelpArticle[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const next = searchArticles(query);
    setResults(next);
    setActiveIndex(-1);
    if (query.trim().length >= 2) {
      trackProductEvent("help_search", { query: query.trim(), resultCount: next.length });
    }
  }, [query]);

  const clear = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (query) {
        e.preventDefault();
        clear();
      }
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const el = document.getElementById(`${listId}-option-${activeIndex}`);
      el?.click();
    }
  };

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search help articles
      </label>
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-3"
        style={{
          backgroundColor: "rgba(30,41,59,0.9)",
          border: "1px solid rgba(148,163,184,0.18)",
        }}
      >
        <Search className="h-4 w-4 shrink-0" style={{ color: "#64748B" }} aria-hidden />
        <input
          id={`${listId}-input`}
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="How can we help you?"
          autoComplete="off"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
          style={{ color: "#E2E8F0" }}
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="rounded-md p-1 text-slate-400 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {query.trim() && (
        <div
          id={listId}
          role="listbox"
          className="mt-3 overflow-hidden rounded-xl"
          style={{
            backgroundColor: "#1E293B",
            border: "1px solid rgba(148,163,184,0.15)",
          }}
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium" style={{ color: "#E2E8F0" }}>
                No results for “{query.trim()}”
              </p>
              <p className="mt-1 text-xs" style={{ color: "#94A3B8" }}>
                Try “booking”, “Open Play”, or “tournament”.
              </p>
              <Link
                to="/help/faq/frequently-asked-questions"
                className="mt-3 inline-block text-xs font-semibold text-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                Browse FAQ
              </Link>
            </div>
          ) : (
            <>
              <p className="px-4 pt-3 text-xs" style={{ color: "#64748B" }}>
                {results.length} result{results.length === 1 ? "" : "s"} for “{query.trim()}”
              </p>
              <ul className="py-2">
                {results.map((article, index) => (
                  <li key={article.id} role="option" aria-selected={index === activeIndex}>
                    <Link
                      id={`${listId}-option-${index}`}
                      to={articlePath(article)}
                      onClick={onResultSelect}
                      className="block px-4 py-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500"
                      style={{
                        backgroundColor: index === activeIndex ? "rgba(59,130,246,0.12)" : "transparent",
                      }}
                    >
                      <p className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>
                        {article.title}
                      </p>
                      <p className="mt-0.5 text-xs capitalize" style={{ color: "#3B82F6" }}>
                        {article.category.replace(/-/g, " ")}
                      </p>
                      <p className="mt-1 text-xs line-clamp-2" style={{ color: "#94A3B8" }}>
                        {article.description}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
