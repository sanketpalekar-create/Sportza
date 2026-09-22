import { Link } from "react-router-dom";
import { LifeBuoy, MessageCircle, Flag } from "lucide-react";
import HelpSearch from "../../help/components/HelpSearch";
import HelpCategoryCard from "../../help/components/HelpCategoryCard";
import HelpArticleCard from "../../help/components/HelpArticleCard";
import { HELP_CATEGORIES, getPopularArticles } from "../../help/content/registry";

export default function HelpCenterPage() {
  const popular = getPopularArticles(undefined, 7);

  return (
    <div className="px-4 pb-8 pt-2" data-guide="help-center">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "#3B82F6" }}>
          Sportza
        </p>
        <h1 className="mt-1 text-2xl font-bold" style={{ color: "#F8FAFC" }}>
          Help Center
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#94A3B8" }}>
          हर दिन. Game On. — find answers and take a quick tour.
        </p>
      </header>

      <HelpSearch autoFocus />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "#CBD5E1" }}>
          Popular articles
        </h2>
        <div className="flex flex-col gap-2">
          {popular.map((article) => (
            <HelpArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "#CBD5E1" }}>
          Categories
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {HELP_CATEGORIES.map((category) => (
            <HelpCategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>

      <section
        className="mt-10 rounded-2xl p-5"
        style={{
          background: "linear-gradient(160deg, rgba(30,58,138,0.45), rgba(15,23,42,0.95))",
          border: "1px solid rgba(59,130,246,0.25)",
        }}
      >
        <div className="mb-3 flex items-center gap-2">
          <LifeBuoy className="h-5 w-5" style={{ color: "#60A5FA" }} aria-hidden />
          <h2 className="text-base font-semibold" style={{ color: "#F8FAFC" }}>
            Still need help?
          </h2>
        </div>
        <p className="mb-4 text-sm" style={{ color: "#94A3B8" }}>
          Reach out and we will help you get back to the game.
        </p>
        <div className="flex flex-col gap-2">
          <a
            href="mailto:support@sportza.in?subject=Sportza%20Support"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            style={{ backgroundColor: "#3B82F6", color: "#fff" }}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Contact Support
          </a>
          <a
            href="mailto:support@sportza.in?subject=Report%20an%20Issue"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            style={{
              backgroundColor: "rgba(15,23,42,0.6)",
              color: "#E2E8F0",
              border: "1px solid rgba(148,163,184,0.2)",
            }}
          >
            <Flag className="h-4 w-4" aria-hidden />
            Report an Issue
          </a>
          <Link
            to="/help/faq/frequently-asked-questions"
            className="text-center text-sm font-semibold text-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Browse FAQ
          </Link>
        </div>
      </section>
    </div>
  );
}
