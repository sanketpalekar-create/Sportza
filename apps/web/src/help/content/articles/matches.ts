import type { HelpArticle } from "../types";

export const matchesArticles: HelpArticle[] = [
  {
    id: "create-join-match",
    slug: "create-join-match",
    title: "How do I create or join a match?",
    description: "Create competitive or casual matches and track results.",
    category: "matches",
    tags: ["matches", "scoring"],
    keywords: ["create match", "join match", "score match"],
    roles: ["player", "all"],
    relatedArticles: ["how-scoring-works", "match-history"],
    order: 1,
    popular: true,
    content: {
      sections: [
        {
          body: "From Matches or Score Match, create a match with sport, format, teams, and date. You can score live or log a quick result depending on the logging mode available.",
        },
        {
          heading: "Match status",
          body: "Matches move through statuses such as scheduled, in progress, and completed. Completed matches feed into your history and stats when processed.",
        },
      ],
    },
  },
  {
    id: "how-scoring-works",
    slug: "how-scoring-works",
    title: "How does match scoring work?",
    description: "Live scoring, events, and confirming results.",
    category: "matches",
    tags: ["scoring", "live match"],
    keywords: ["scoring", "live score", "match events"],
    roles: ["player", "all"],
    relatedArticles: ["create-join-match", "how-stats-calculated"],
    order: 2,
    content: {
      sections: [
        {
          body: "During a live match you can update scores and record sport-specific events where supported. Some sports use detailed event logging; others use a simple final score.",
        },
        {
          heading: "Confirmations",
          body: "Players may be asked to confirm match results. Confirmations help keep stats accurate.",
          tip: "Sportza supports multiple sports — scoring UI adapts to the sport and format you selected.",
        },
      ],
    },
  },
  {
    id: "match-history",
    slug: "match-history",
    title: "Where can I see my game history?",
    description: "Find past matches and outcomes from Matches and Stats.",
    category: "matches",
    tags: ["history", "matches"],
    keywords: ["game history", "match history", "past matches"],
    roles: ["player", "all"],
    relatedArticles: ["how-stats-calculated", "create-join-match"],
    order: 3,
    popular: true,
    content: {
      sections: [
        {
          body: "Open Matches for your recent and past games, or Stats for aggregated performance. Tap a match for scores, events, and participants.",
        },
      ],
    },
  },
];

export const statsArticles: HelpArticle[] = [
  {
    id: "how-stats-calculated",
    slug: "how-stats-calculated",
    title: "How are match stats calculated?",
    description: "How Sportza builds player stats and performance views.",
    category: "stats",
    tags: ["stats", "performance"],
    keywords: ["stats", "win percentage", "player statistics"],
    roles: ["player", "all"],
    relatedArticles: ["leaderboards", "skill-ratings"],
    order: 1,
    popular: true,
    content: {
      sections: [
        {
          body: "After matches are completed and processed, Sportza updates player stats such as matches played, wins, losses, and sport-specific metrics where available.",
        },
        {
          heading: "What we do not invent",
          body: "Detailed formulas can vary by sport and logging mode. Use Stats and sport dashboards for the metrics currently shown for your sports — conceptual explanations appear next to advanced views where provided.",
        },
      ],
    },
  },
  {
    id: "leaderboards",
    slug: "leaderboards",
    title: "How do leaderboards work?",
    description: "See how you rank against other players.",
    category: "stats",
    tags: ["leaderboard", "ranking"],
    keywords: ["leaderboard", "ranking", "top players"],
    roles: ["player", "all"],
    relatedArticles: ["how-stats-calculated", "skill-ratings"],
    order: 2,
    content: {
      sections: [
        {
          body: "Open Stats → Leaderboard (or Leaderboard from discovery). Rankings are typically sport-based and may use skill ratings or performance metrics depending on what is enabled for that sport.",
        },
      ],
    },
  },
  {
    id: "skill-ratings",
    slug: "skill-ratings",
    title: "What are skill ratings?",
    description: "Understand competitive ratings and confidence levels.",
    category: "stats",
    tags: ["rating", "elo", "skill"],
    keywords: ["skill rating", "elo", "rank"],
    roles: ["player", "all"],
    relatedArticles: ["how-stats-calculated", "leaderboards"],
    order: 3,
    content: {
      sections: [
        {
          body: "Where skill ratings are enabled, Sportza tracks a rating per sport (and sometimes format). Ratings update as you play competitive matches. Confidence may show as unranked until you have enough games.",
        },
      ],
    },
  },
];
