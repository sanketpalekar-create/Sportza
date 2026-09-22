import type { HelpArticle } from "../types";

export const tournamentsArticles: HelpArticle[] = [
  {
    id: "how-tournaments-work",
    slug: "how-tournaments-work",
    title: "How do tournaments work?",
    description: "Discover tournaments, register, follow fixtures, and see results.",
    category: "tournaments",
    tags: ["tournaments", "fixtures"],
    keywords: ["tournament", "register", "bracket", "fixtures"],
    roles: ["all"],
    relatedArticles: ["register-for-tournament", "tournament-fixtures"],
    order: 1,
    popular: true,
    content: {
      sections: [
        {
          body: "Tournaments let organisers run multi-team events with registrations, fixtures, matches, and results. Formats may include league or knockout-style stages depending on how the organiser configured the event.",
        },
        {
          heading: "Statuses",
          body: "Tournaments typically move from draft → registration → in progress → completed. Only published or open tournaments appear in discovery for players.",
        },
      ],
    },
  },
  {
    id: "register-for-tournament",
    slug: "register-for-tournament",
    title: "How do I register for a tournament?",
    description: "Join an open tournament as a player or team.",
    category: "tournaments",
    tags: ["tournaments", "register"],
    keywords: ["register tournament", "join tournament", "team registration"],
    roles: ["player", "all"],
    relatedArticles: ["how-tournaments-work", "tournament-fixtures"],
    order: 2,
    content: {
      sections: [
        {
          body: "Open Tournaments → select an event → Register. Follow on-screen steps for individual or team registration. Capacity and deadlines are set by the organiser.",
        },
      ],
    },
  },
  {
    id: "tournament-fixtures",
    slug: "tournament-fixtures",
    title: "Fixtures, results, and brackets",
    description: "Follow match schedule and outcomes during a tournament.",
    category: "tournaments",
    tags: ["fixtures", "results"],
    keywords: ["fixtures", "bracket", "results", "sumula"],
    roles: ["all"],
    relatedArticles: ["how-tournaments-work"],
    order: 3,
    content: {
      sections: [
        {
          body: "On a tournament page, browse fixtures by round or stage. Completed matches show results. Spectator and sumula views may be available depending on the event.",
          tip: "Tournament rules and formats are defined by each organiser — check the tournament description for event-specific rules.",
        },
      ],
    },
  },
];

export const paymentsArticles: HelpArticle[] = [
  {
    id: "payment-flow",
    slug: "payment-flow",
    title: "How do payments work?",
    description: "Pay for bookings and other fees securely with Razorpay.",
    category: "payments",
    tags: ["payments", "razorpay"],
    keywords: ["payment", "razorpay", "checkout", "pay"],
    roles: ["all"],
    relatedArticles: ["payment-confirmation", "refunds", "wallet"],
    order: 1,
    popular: true,
    content: {
      sections: [
        {
          body: "When a booking or fee requires payment, Sportza opens a secure checkout powered by Razorpay. Complete payment with UPI, card, or other methods offered by the gateway.",
        },
        {
          heading: "Failed payments",
          body: "If payment fails, your booking may stay pending or the hold may expire. Retry from the booking or payment screen. Never share OTP or card details outside the official checkout.",
        },
      ],
    },
  },
  {
    id: "payment-confirmation",
    slug: "payment-confirmation",
    title: "What happens after payment?",
    description: "Confirmation, receipts, and booking status after a successful pay.",
    category: "payments",
    tags: ["payments", "receipt"],
    keywords: ["payment confirmation", "receipt", "paid"],
    roles: ["all"],
    relatedArticles: ["payment-flow", "booking-history"],
    order: 2,
    content: {
      sections: [
        {
          body: "After a successful payment, your booking or fee status updates to paid/confirmed. You can view payment history and receipts under Payments.",
        },
      ],
    },
  },
  {
    id: "refunds",
    slug: "refunds",
    title: "Refunds",
    description: "When refunds apply and how they are processed.",
    category: "payments",
    tags: ["refunds", "cancel"],
    keywords: ["refund", "money back", "cancellation refund"],
    roles: ["all"],
    relatedArticles: ["cancel-a-booking", "payment-flow"],
    order: 3,
    content: {
      sections: [
        {
          body: "Refunds may apply when a booking is cancelled under eligible conditions, or when Sportza/venue policies allow. Refunds are typically sent to the original payment method when supported.",
        },
        {
          heading: "Policy note",
          body: "Exact refund amounts, platform fees, and timelines are policy-dependent. Always review the cancellation and refund notice shown in the app for that booking.",
        },
      ],
    },
  },
  {
    id: "wallet",
    slug: "wallet",
    title: "Sportza Wallet",
    description: "Use wallet balance for eligible payments when available.",
    category: "payments",
    tags: ["wallet", "balance"],
    keywords: ["wallet", "balance", "credits"],
    roles: ["all"],
    relatedArticles: ["payment-flow"],
    order: 4,
    content: {
      sections: [
        {
          body: "If your account has a Sportza Wallet, you can view balance and transactions from the wallet/payments areas of the app. Wallet may be used for eligible payments such as certain splits or holds when offered.",
        },
      ],
    },
  },
];
