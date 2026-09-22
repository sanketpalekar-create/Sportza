import {
  ALL_ARTICLES,
  getArticle,
  getArticlesByCategory,
  getPopularArticles,
  searchArticles,
  articlePath,
  estimateReadingMinutes,
} from "./registry";
import { HELP_CATEGORIES } from "./categories";

/** Content registry self-checks (no vitest dependency in web). */
export function assertHelpRegistryHealthy(): void {
  if (ALL_ARTICLES.length < 10) throw new Error("Expected at least 10 help articles");

  for (const article of ALL_ARTICLES) {
    if (!article.id || !article.slug || !article.title || !article.category) {
      throw new Error(`Invalid article: ${article.id}`);
    }
    if (!article.content.sections.length) {
      throw new Error(`Article ${article.id} has no sections`);
    }
  }

  if (!getArticle("how-to-book-a-venue")) throw new Error("booking article missing");
  if (!getArticle("what-is-sportza")) throw new Error("intro article missing");

  const venues = getArticlesByCategory("venues");
  if (!venues.length) throw new Error("venues category empty");

  const bookingHits = searchArticles("booking");
  if (!bookingHits.length) throw new Error("search for booking returned no results");

  const popular = getPopularArticles(undefined, 5);
  if (!popular.length) throw new Error("no popular articles");

  const article = getArticle("how-to-book-a-venue")!;
  if (articlePath(article) !== "/help/venues/how-to-book-a-venue") {
    throw new Error("unexpected article path");
  }
  if (estimateReadingMinutes(article) < 1) throw new Error("reading time invalid");

  const catIds = new Set(HELP_CATEGORIES.map((c) => c.id));
  for (const a of ALL_ARTICLES) {
    if (!catIds.has(a.category)) throw new Error(`Unknown category ${a.category}`);
  }
}
