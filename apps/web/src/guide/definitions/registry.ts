import type { GuideDef } from "../types";

export const GUIDE_DEFINITIONS: GuideDef[] = [
  {
    id: "welcome",
    version: 1,
    title: "Welcome to Sportza",
    description: "A quick intro to discovering venues, playing, training, and tracking.",
    roles: ["all"],
    trigger: { type: "first_login" },
    priority: 100,
    steps: [
      {
        id: "welcome-home",
        target: "[data-guide='dashboard']",
        title: "Your game starts here",
        description: "Home shows nearby venues, Open Plays, training, and your Get Started checklist.",
        placement: "bottom",
      },
      {
        id: "welcome-checklist",
        target: "[data-guide='get-started-checklist']",
        title: "Get Started checklist",
        description: "Complete a few optional steps to unlock Sportza at your own pace.",
        placement: "top",
        optional: true,
      },
      {
        id: "welcome-nav",
        target: "[data-guide='bottom-nav']",
        title: "Navigate with tabs",
        description: "Jump between Home, Bookings, Play, Stats, and Profile anytime.",
        placement: "top",
      },
    ],
  },
  {
    id: "dashboard",
    version: 1,
    title: "Dashboard tour",
    description: "Learn the Home layout and quick actions.",
    roles: ["player", "all"],
    trigger: { type: "manual" },
    priority: 50,
    steps: [
      {
        id: "dash-greeting",
        target: "[data-guide='dashboard']",
        title: "Your dashboard",
        description: "See personalised recommendations based on location and sports.",
        placement: "bottom",
      },
      {
        id: "dash-checklist",
        target: "[data-guide='get-started-checklist']",
        title: "Track your progress",
        description: "Tap any checklist item to jump straight to that action.",
        placement: "top",
        optional: true,
      },
      {
        id: "dash-venues",
        target: "[data-guide='home-venues']",
        title: "Find a venue",
        description: "Browse venues near you and book a slot when you are ready.",
        placement: "top",
        optional: true,
      },
      {
        id: "dash-help",
        target: "[data-guide='nav-profile']",
        title: "Need help later?",
        description:
          "Find the Help Center anytime from your Profile tab — articles, FAQ, and product tours.",
        placement: "top",
        optional: true,
      },
    ],
  },
  {
    id: "venue-booking",
    version: 1,
    title: "Book a venue",
    description: "Search, explore, and book a sports venue.",
    roles: ["player", "all"],
    trigger: { type: "first_visit", route: "/venues" },
    priority: 40,
    steps: [
      {
        id: "venue-search",
        target: "[data-guide='venue-search']",
        title: "Find a venue",
        description: "Search by sport and location to discover courts and grounds near you.",
        placement: "bottom",
      },
      {
        id: "venue-card",
        target: "[data-guide='venue-card']",
        title: "Explore venue details",
        description: "Check sports, facilities, ratings, and timings before you book.",
        placement: "top",
      },
      {
        id: "book-button",
        target: "[data-guide='book-button']",
        title: "Book your slot",
        description: "Choose date and time, then continue to payment and confirmation.",
        placement: "top",
        optional: true,
      },
    ],
  },
  {
    id: "open-play",
    version: 1,
    title: "Open Play",
    description: "Discover sessions and join other players.",
    roles: ["player", "all"],
    trigger: { type: "first_visit", route: "/open-plays" },
    priority: 35,
    steps: [
      {
        id: "open-play-list",
        target: "[data-guide='open-play-list']",
        title: "Browse Open Plays",
        description: "See upcoming sessions with spots available.",
        placement: "bottom",
      },
      {
        id: "join-open-play",
        target: "[data-guide='join-open-play']",
        title: "Join a session",
        description: "Open a session and join if there is room and it fits your level.",
        placement: "top",
        optional: true,
      },
    ],
  },
  {
    id: "training",
    version: 1,
    title: "Training",
    description: "Find trainers and join batches.",
    roles: ["player", "all"],
    trigger: { type: "first_visit", route: "/training" },
    priority: 30,
    steps: [
      {
        id: "training-search",
        target: "[data-guide='training-search']",
        title: "Discover training",
        description: "Browse batches and trainers by sport and schedule.",
        placement: "bottom",
      },
      {
        id: "training-batch",
        target: "[data-guide='training-batch']",
        title: "Join a batch",
        description: "Open a batch to review fees, capacity, and join options.",
        placement: "top",
        optional: true,
      },
    ],
  },
  {
    id: "match",
    version: 1,
    title: "Match tracking",
    description: "Create matches and record scores.",
    roles: ["player", "all"],
    trigger: { type: "manual" },
    priority: 25,
    steps: [
      {
        id: "matches-list",
        target: "[data-guide='matches-list']",
        title: "Your matches",
        description: "Create a match or open an existing one to score live.",
        placement: "bottom",
        optional: true,
      },
      {
        id: "score-match",
        target: "[data-guide='score-match']",
        title: "Score a match",
        description: "Log results so they count toward your stats and history.",
        placement: "top",
        optional: true,
      },
    ],
  },
  {
    id: "stats",
    version: 1,
    title: "Stats",
    description: "Track performance and leaderboards.",
    roles: ["player", "all"],
    trigger: { type: "manual" },
    priority: 20,
    steps: [
      {
        id: "stats-overview",
        target: "[data-guide='stats-overview']",
        title: "Your stats",
        description: "See matches played, wins, and sport-specific performance.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "tournament",
    version: 1,
    title: "Tournaments",
    description: "Discover events and follow fixtures.",
    roles: ["all"],
    trigger: { type: "manual" },
    priority: 15,
    steps: [
      {
        id: "tournament-list",
        target: "[data-guide='tournament-list']",
        title: "Explore tournaments",
        description: "Browse open events, register, and follow fixtures and results.",
        placement: "bottom",
      },
    ],
  },
];

export function getGuide(id: string): GuideDef | undefined {
  return GUIDE_DEFINITIONS.find((g) => g.id === id);
}

export function getGuidesForRole(role: string): GuideDef[] {
  return GUIDE_DEFINITIONS.filter(
    (g) => g.roles.includes("all") || g.roles.includes(role as GuideDef["roles"][number])
  );
}

export function getFirstVisitGuide(pathname: string, role: string): GuideDef | undefined {
  const base = pathname.split("?")[0].replace(/\/$/, "") || "/";
  return getGuidesForRole(role)
    .filter((g) => g.trigger.type === "first_visit" && g.trigger.route === base)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
}
