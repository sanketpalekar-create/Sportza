import type { HelpArticle } from "../types";

export const openPlayArticles: HelpArticle[] = [
  {
    id: "what-is-open-play",
    slug: "what-is-open-play",
    title: "What is Open Play?",
    description: "Open Play helps you find or host sessions and join other players.",
    category: "open-play",
    tags: ["open play", "join", "social"],
    keywords: ["open play", "pickup game", "join session"],
    roles: ["player", "all"],
    relatedArticles: ["join-open-play", "create-open-play"],
    order: 1,
    popular: true,
    content: {
      sections: [
        {
          body: "Open Play is a way to discover booked sessions that still need players — or to host one yourself. You see sport, format, venue, time, skill level (if set), and how many spots are left.",
        },
        {
          heading: "Who it is for",
          body: "Players who want a game without organising everything from scratch, and hosts who want to fill remaining slots after booking a venue.",
        },
      ],
    },
  },
  {
    id: "join-open-play",
    slug: "join-open-play",
    title: "How do I join an Open Play?",
    description: "Browse Open Plays and join a session that fits your schedule.",
    category: "open-play",
    tags: ["open play", "join"],
    keywords: ["join open play", "participate"],
    roles: ["player", "all"],
    relatedArticles: ["what-is-open-play", "create-open-play"],
    order: 2,
    popular: true,
    content: {
      sections: [
        {
          body: "Open Play (Play tab) → browse sessions → open details → Join. Some sessions may require payment of a per-player share or meet skill criteria set by the host.",
        },
        {
          heading: "Leaving a session",
          body: "If leaving is supported for that session, use the leave or cancel participation action on the Open Play detail screen before the session starts.",
        },
      ],
    },
  },
  {
    id: "create-open-play",
    slug: "create-open-play",
    title: "How do I create an Open Play?",
    description: "Host an Open Play after booking a venue so others can join.",
    category: "open-play",
    tags: ["open play", "create", "host"],
    keywords: ["create open play", "host session"],
    roles: ["player", "all"],
    relatedArticles: ["what-is-open-play", "how-to-book-a-venue"],
    order: 3,
    content: {
      sections: [
        {
          body: "Create Open Play typically starts from a booking. Set format, max players, optional skill range, notes, and join deadline if shown. Publish so others can discover and join.",
        },
        {
          heading: "Participant limits",
          body: "Max players and minimum players are set when you create the session. The session status updates as players join or when deadlines pass.",
        },
      ],
    },
  },
];

export const trainingArticles: HelpArticle[] = [
  {
    id: "find-training",
    slug: "find-training",
    title: "How do I find training and trainers?",
    description: "Discover trainers, academies, and training batches near you.",
    category: "training",
    tags: ["training", "trainers", "batches"],
    keywords: ["training", "coach", "academy", "batch"],
    roles: ["player", "all"],
    relatedArticles: ["join-training-batch", "trainer-reviews"],
    order: 1,
    popular: true,
    content: {
      sections: [
        {
          body: "Open Training or Trainers to browse batches and coach profiles. Filter by sport and location. Batch cards show schedule, capacity, fees (when listed), and skill range if set.",
        },
      ],
    },
  },
  {
    id: "join-training-batch",
    slug: "join-training-batch",
    title: "How do I join a training batch?",
    description: "Enrol in a batch and complete any required payment.",
    category: "training",
    tags: ["training", "join", "fees"],
    keywords: ["join batch", "enrol training", "training fees"],
    roles: ["player", "all"],
    relatedArticles: ["find-training", "payment-flow"],
    order: 2,
    popular: true,
    content: {
      sections: [
        {
          body: "Open a batch → review schedule, fees, and join type → Join or Request to join. Some batches confirm instantly; others may need trainer approval. Complete payment as prompted.",
        },
        {
          heading: "My batches",
          body: "Joined batches appear under My Batches so you can track sessions and announcements.",
        },
      ],
    },
  },
  {
    id: "trainer-reviews",
    slug: "trainer-reviews",
    title: "Trainer reviews and ratings",
    description: "How trainer ratings work and how to leave feedback.",
    category: "training",
    tags: ["reviews", "trainers"],
    keywords: ["trainer review", "coach rating"],
    roles: ["player", "all"],
    relatedArticles: ["find-training", "leave-a-review"],
    order: 3,
    content: {
      sections: [
        {
          body: "Trainer profiles show average rating and review count. After training with a coach, you can leave a review from their profile or reviews section when the app offers it.",
        },
      ],
    },
  },
];
