import type { HelpArticle, HelpCategoryId, HelpRole } from "./types";
import { HELP_CATEGORIES } from "./categories";
import { gettingStartedArticles } from "./articles/getting-started";
import { venuesArticles, bookingsArticles } from "./articles/venues";
import { openPlayArticles, trainingArticles } from "./articles/open-play";
import { matchesArticles, statsArticles } from "./articles/matches";
import { tournamentsArticles, paymentsArticles } from "./articles/tournaments";
import {
  accountArticles,
  reviewsArticles,
  notificationsArticles,
  troubleshootingArticles,
  faqArticles,
} from "./articles/account";

const ALL_ARTICLES: HelpArticle[] = [
  ...gettingStartedArticles,
  ...venuesArticles,
  ...bookingsArticles,
  ...openPlayArticles,
  ...trainingArticles,
  ...matchesArticles,
  ...statsArticles,
  ...tournamentsArticles,
  ...paymentsArticles,
  ...reviewsArticles,
  ...notificationsArticles,
  ...accountArticles,
  ...troubleshootingArticles,
  ...faqArticles,
].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

const byId = new Map(ALL_ARTICLES.map((a) => [a.id, a]));
const bySlug = new Map(ALL_ARTICLES.map((a) => [a.slug, a]));

export function getAllArticles(role?: HelpRole): HelpArticle[] {
  if (!role || role === "all") return ALL_ARTICLES;
  return ALL_ARTICLES.filter(
    (a) => a.roles.includes("all") || a.roles.includes(role)
  );
}

export function getArticle(slugOrId: string): HelpArticle | undefined {
  return bySlug.get(slugOrId) ?? byId.get(slugOrId);
}

export function getArticlesByCategory(
  category: HelpCategoryId | string,
  role?: HelpRole
): HelpArticle[] {
  return getAllArticles(role).filter((a) => a.category === category);
}

export function getPopularArticles(role?: HelpRole, limit = 7): HelpArticle[] {
  return getAllArticles(role)
    .filter((a) => a.popular)
    .slice(0, limit);
}

export function getRelatedArticles(article: HelpArticle): HelpArticle[] {
  return article.relatedArticles
    .map((id) => byId.get(id) ?? bySlug.get(id))
    .filter((a): a is HelpArticle => !!a);
}

export function searchArticles(
  query: string,
  role?: HelpRole
): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);
  const articles = getAllArticles(role);

  const scored = articles
    .map((article) => {
      const haystack = [
        article.title,
        article.description,
        article.category,
        ...article.tags,
        ...article.keywords,
        ...article.content.sections.map((s) => `${s.heading ?? ""} ${s.body}`),
      ]
        .join(" ")
        .toLowerCase();

      let score = 0;
      for (const token of tokens) {
        if (article.title.toLowerCase().includes(token)) score += 8;
        if (article.keywords.some((k) => k.toLowerCase().includes(token))) score += 5;
        if (article.tags.some((t) => t.toLowerCase().includes(token))) score += 4;
        if (article.description.toLowerCase().includes(token)) score += 3;
        if (article.category.includes(token)) score += 2;
        if (haystack.includes(token)) score += 1;
      }
      return { article, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title));

  return scored.map((r) => r.article);
}

export function articlePath(article: HelpArticle): string {
  return `/help/${article.category}/${article.slug}`;
}

export function estimateReadingMinutes(article: HelpArticle): number {
  const words = article.content.sections
    .map((s) => `${s.heading ?? ""} ${s.body} ${s.tip ?? ""}`)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export { HELP_CATEGORIES, ALL_ARTICLES };
