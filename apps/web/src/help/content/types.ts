export type HelpRole =
  | "player"
  | "coach"
  | "trainer"
  | "venue_owner"
  | "admin"
  | "all";

export type HelpCategoryId =
  | "getting-started"
  | "venues"
  | "bookings"
  | "open-play"
  | "training"
  | "matches"
  | "stats"
  | "tournaments"
  | "payments"
  | "reviews"
  | "notifications"
  | "account"
  | "troubleshooting"
  | "faq";

export interface HelpCategory {
  id: HelpCategoryId;
  slug: string;
  title: string;
  description: string;
  icon: string;
  order: number;
  roles: HelpRole[];
}

export interface ArticleSection {
  heading?: string;
  body: string;
  tip?: string;
}

export interface ArticleContent {
  sections: ArticleSection[];
}

export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: HelpCategoryId;
  tags: string[];
  keywords: string[];
  roles: HelpRole[];
  relatedArticles: string[];
  order: number;
  content: ArticleContent;
  popular?: boolean;
}
