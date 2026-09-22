import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import HelpArticleCard from "../../help/components/HelpArticleCard";
import { getCategoryBySlug } from "../../help/content/categories";
import { getArticlesByCategory } from "../../help/content/registry";

export default function HelpCategoryPage() {
  const { category: categorySlug = "" } = useParams();
  const category = getCategoryBySlug(categorySlug);
  const articles = category ? getArticlesByCategory(category.id) : [];

  if (!category) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm" style={{ color: "#E2E8F0" }}>
          Category not found.
        </p>
        <Link to="/help" className="mt-3 inline-block text-sm font-semibold text-blue-400">
          Back to Help Center
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-2">
      <nav className="mb-4 flex items-center gap-2 text-xs" aria-label="Breadcrumb">
        <Link to="/help" className="inline-flex items-center gap-1 font-medium text-blue-400">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Help
        </Link>
        <span style={{ color: "#475569" }}>/</span>
        <span style={{ color: "#94A3B8" }}>{category.title}</span>
      </nav>

      <h1 className="text-xl font-bold" style={{ color: "#F8FAFC" }}>
        {category.title}
      </h1>
      <p className="mt-1 text-sm" style={{ color: "#94A3B8" }}>
        {category.description}
      </p>

      <div className="mt-6 flex flex-col gap-2">
        {articles.length === 0 ? (
          <p className="text-sm" style={{ color: "#64748B" }}>
            No articles in this category yet.
          </p>
        ) : (
          articles.map((article) => <HelpArticleCard key={article.id} article={article} />)
        )}
      </div>
    </div>
  );
}
