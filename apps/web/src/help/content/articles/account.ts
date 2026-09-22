import type { HelpArticle } from "../types";

export const accountArticles: HelpArticle[] = [
  {
    id: "account-settings",
    slug: "account-settings",
    title: "Account settings and security",
    description: "Manage profile, password, privacy, and logout.",
    category: "account",
    tags: ["account", "security", "settings"],
    keywords: ["settings", "password", "logout", "privacy", "security"],
    roles: ["all"],
    relatedArticles: ["complete-profile", "notifications-overview"],
    order: 1,
    content: {
      sections: [
        {
          body: "From Profile open Settings for account preferences, Privacy for privacy controls, and Edit profile for name, sports, and avatar.",
        },
        {
          heading: "Password and login",
          body: "If you use email/password login, you can reset via Forgot password. Google-linked accounts sign in with Google. Log out from Profile when finished on a shared device.",
        },
      ],
    },
  },
  {
    id: "roles-on-sportza",
    slug: "roles-on-sportza",
    title: "Player, Coach, and Venue Owner roles",
    description: "How roles work and how to switch between them.",
    category: "account",
    tags: ["roles", "coach", "venue owner"],
    keywords: ["role", "coach", "trainer", "venue owner", "switch role"],
    roles: ["all"],
    relatedArticles: ["account-settings"],
    order: 2,
    content: {
      sections: [
        {
          body: "Most users start as Players. You can apply for Coach/Trainer or Venue Owner from role options in the app. Applications may require admin approval before the role is active.",
        },
        {
          heading: "Switching roles",
          body: "If you have multiple roles, use the role switcher (role badge) to change mode. Navigation tabs update to match the active role.",
        },
      ],
    },
  },
];

export const reviewsArticles: HelpArticle[] = [
  {
    id: "leave-a-review",
    slug: "leave-a-review",
    title: "How do I leave a review?",
    description: "Rate venues and trainers after your experience.",
    category: "reviews",
    tags: ["reviews", "ratings"],
    keywords: ["review", "rating", "feedback", "venue review"],
    roles: ["player", "all"],
    relatedArticles: ["trainer-reviews", "venue-details"],
    order: 1,
    content: {
      sections: [
        {
          body: "Open a venue or trainer profile and submit a star rating with an optional written review. Be fair and specific — reviews help the community choose where to play and train.",
        },
        {
          heading: "Editing reviews",
          body: "If editing or removing a review is supported for that review type, use the edit controls on your review. Otherwise contact support if you need a review corrected.",
        },
      ],
    },
  },
];

export const notificationsArticles: HelpArticle[] = [
  {
    id: "notifications-overview",
    slug: "notifications-overview",
    title: "Notifications on Sportza",
    description: "Booking, match, training, and payment alerts.",
    category: "notifications",
    tags: ["notifications", "alerts"],
    keywords: ["notification", "alerts", "push", "email"],
    roles: ["all"],
    relatedArticles: ["account-settings"],
    order: 1,
    content: {
      sections: [
        {
          body: "Sportza can notify you about booking confirmations, match updates, tournament updates, training announcements, peer invites, and payment-related events.",
        },
        {
          heading: "Preferences",
          body: "Open Notifications to read in-app alerts. Adjust email and push preferences from notification preferences / settings when available.",
        },
      ],
    },
  },
];

export const troubleshootingArticles: HelpArticle[] = [
  {
    id: "cannot-login",
    slug: "cannot-login",
    title: "I cannot log in",
    description: "Fix common login and session issues.",
    category: "troubleshooting",
    tags: ["login", "troubleshoot"],
    keywords: ["cannot login", "login failed", "session expired"],
    roles: ["all"],
    relatedArticles: ["create-account", "account-settings"],
    order: 1,
    content: {
      sections: [
        {
          body: "Check your email/phone and password, or complete OTP again. Use Forgot password if needed. Clear site data or try another browser if an old session is stuck. For Google Sign-In, ensure pop-ups are allowed.",
        },
      ],
    },
  },
  {
    id: "payment-failed",
    slug: "payment-failed",
    title: "My payment failed",
    description: "What to do when checkout does not complete.",
    category: "troubleshooting",
    tags: ["payments", "troubleshoot"],
    keywords: ["payment failed", "razorpay error", "checkout"],
    roles: ["all"],
    relatedArticles: ["payment-flow", "payment-confirmation"],
    order: 2,
    content: {
      sections: [
        {
          body: "Do not pay twice until you check Bookings/Payments for a successful charge. Retry checkout, try another payment method, or contact your bank. If money was deducted but booking is unpaid, contact support with the payment reference — never share full card details.",
        },
      ],
    },
  },
];

export const faqArticles: HelpArticle[] = [
  {
    id: "faq-main",
    slug: "frequently-asked-questions",
    title: "Frequently asked questions",
    description: "Quick answers about booking, Open Play, training, and more.",
    category: "faq",
    tags: ["faq"],
    keywords: ["faq", "questions", "help"],
    roles: ["all"],
    relatedArticles: ["what-is-sportza", "how-to-book-a-venue", "what-is-open-play"],
    order: 1,
    popular: true,
    content: {
      sections: [
        {
          heading: "Is Sportza free to join?",
          body: "Creating an account is free. You pay only for bookings, training fees, Open Play shares, or other paid features when you use them.",
        },
        {
          heading: "Can I book without choosing sports on my profile?",
          body: "Yes, but selecting sports helps discovery. You can still search venues by sport at booking time.",
        },
        {
          heading: "What is the difference between Open Play and a private booking?",
          body: "A private booking reserves a slot for you. Open Play opens leftover spots (or a hosted session) so others can join.",
        },
        {
          heading: "Can coaches and venue owners use the same account?",
          body: "Yes if multiple roles are approved on your account. Switch roles from the role badge.",
        },
        {
          heading: "Where do I see receipts?",
          body: "Open Payments or the booking detail / payment receipt screens after a successful payment.",
        },
        {
          heading: "Does Sportza work on mobile?",
          body: "Yes. The web app is mobile-first, and there is also a mobile app in the Sportza ecosystem.",
        },
        {
          heading: "Who do I contact for support?",
          body: "Use Help Center → Still need help, or Contact Support from Help. Include booking IDs or screenshots when reporting payment issues.",
        },
      ],
    },
  },
];
