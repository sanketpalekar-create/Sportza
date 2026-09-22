import type { HelpArticle } from "../types";

export const gettingStartedArticles: HelpArticle[] = [
  {
    id: "what-is-sportza",
    slug: "what-is-sportza",
    title: "What is Sportza?",
    description: "A quick overview of Sportza and how it helps you play, train, and compete.",
    category: "getting-started",
    tags: ["intro", "overview"],
    keywords: ["sportza", "what is", "platform", "game on"],
    roles: ["all"],
    relatedArticles: ["create-account", "dashboard-overview"],
    order: 1,
    popular: true,
    content: {
      sections: [
        {
          body: "Sportza is a sports ecosystem platform that helps you discover venues, find people to play with, join training sessions, participate in matches and tournaments, and track your performance — all in one place.",
        },
        {
          heading: "What you can do",
          body: "Discover and book sports venues, join Open Plays, enrol in training batches, create and score matches, view stats and leaderboards, join tournaments, manage teams and fixtures, make payments, leave reviews, and receive notifications about your games.",
        },
        {
          heading: "Our tagline",
          body: "हर दिन. Game On. — Sportza is built for everyday play. Whether you are booking a court tonight or tracking season-long stats, the goal is simple: get you on the field faster.",
          tip: "Start with the Get Started checklist on your Home dashboard to unlock the core features step by step.",
        },
      ],
    },
  },
  {
    id: "create-account",
    slug: "create-account",
    title: "How do I create an account?",
    description: "Sign up with email, phone OTP, or Google to start using Sportza.",
    category: "getting-started",
    tags: ["account", "signup", "login"],
    keywords: ["register", "sign up", "create account", "google", "otp"],
    roles: ["all"],
    relatedArticles: ["what-is-sportza", "complete-profile"],
    order: 2,
    popular: true,
    content: {
      sections: [
        {
          body: "Open Sportza and tap Register (or Sign up). You can create an account with email and password, phone OTP, or Google Sign-In where available.",
        },
        {
          heading: "After signup",
          body: "Once your account is created you are taken to Home. Complete your profile and select your sports so Sportza can show relevant venues, Open Plays, and training near you.",
        },
        {
          heading: "Already have an account?",
          body: "Use Login. If you forget your password, use Forgot password to reset it via email.",
        },
      ],
    },
  },
  {
    id: "complete-profile",
    slug: "complete-profile",
    title: "How do I complete my profile?",
    description: "Add your name, photo, sports, and location so Sportza can personalise your experience.",
    category: "getting-started",
    tags: ["profile", "sports", "setup"],
    keywords: ["profile", "avatar", "sports preferences", "name"],
    roles: ["all"],
    relatedArticles: ["create-account", "dashboard-overview"],
    order: 3,
    content: {
      sections: [
        {
          body: "Go to Profile → Edit profile. Add your name, avatar, preferred sports, and location. These details help with venue discovery, matchmaking, and training suggestions.",
        },
        {
          heading: "Sports preferences",
          body: "Select the sports you play. Sportza uses this to filter venues, Open Plays, batches, and leaderboards for you.",
          tip: "You can update sports anytime from your profile.",
        },
      ],
    },
  },
  {
    id: "dashboard-overview",
    slug: "dashboard-overview",
    title: "Understanding your Home dashboard",
    description: "Learn what appears on Home and how to navigate Sportza day to day.",
    category: "getting-started",
    tags: ["dashboard", "home", "navigation"],
    keywords: ["home", "dashboard", "get started", "checklist"],
    roles: ["all"],
    relatedArticles: ["complete-profile", "how-to-book-a-venue"],
    order: 4,
    content: {
      sections: [
        {
          body: "Home is your daily hub. Depending on your role (Player, Coach, Venue Owner, or Admin), you see upcoming bookings, nearby venues, Open Plays, training, and tournaments.",
        },
        {
          heading: "Get Started checklist",
          body: "New players see a Get Started checklist. Tick off items like completing your profile, booking a venue, joining an Open Play, and viewing stats. You can dismiss it and reopen it later from Help.",
        },
        {
          heading: "Bottom navigation",
          body: "Use the bottom tabs to jump between Home, Bookings, Play (Open Plays), Stats, and Profile. Coaches and venue owners get role-specific tabs when you switch role.",
        },
      ],
    },
  },
];
