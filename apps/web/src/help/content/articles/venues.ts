import type { HelpArticle } from "../types";

export const venuesArticles: HelpArticle[] = [
  {
    id: "find-a-venue",
    slug: "find-a-venue",
    title: "How do I find a venue?",
    description: "Search and filter sports venues by sport, city, and location.",
    category: "venues",
    tags: ["venues", "search", "discover"],
    keywords: ["find venue", "search court", "grounds", "near me"],
    roles: ["all"],
    relatedArticles: ["how-to-book-a-venue", "venue-details"],
    order: 1,
    popular: true,
    content: {
      sections: [
        {
          body: "Open Venues from Home or search. Filter by sport and city, or use your set location to see nearby options.",
        },
        {
          heading: "Browsing results",
          body: "Each venue card shows sports offered, location, and ratings where available. Tap a card to open venue details.",
        },
      ],
    },
  },
  {
    id: "venue-details",
    slug: "venue-details",
    title: "Understanding venue details",
    description: "Facilities, sports, timings, rates, and reviews on a venue page.",
    category: "venues",
    tags: ["venues", "facilities", "rates"],
    keywords: ["venue details", "facilities", "price", "availability"],
    roles: ["all"],
    relatedArticles: ["find-a-venue", "how-to-book-a-venue"],
    order: 2,
    content: {
      sections: [
        {
          body: "A venue page shows sports, facilities/courts, amenities, photos, pricing, and reviews. Check availability for your preferred date before booking.",
        },
        {
          heading: "Availability",
          body: "Choose a sport and date to see available time slots. Some venues have different rates by time of day or facility.",
        },
      ],
    },
  },
  {
    id: "how-to-book-a-venue",
    slug: "how-to-book-a-venue",
    title: "How do I book a venue?",
    description: "Step-by-step guide to selecting a slot and confirming a booking.",
    category: "venues",
    tags: ["booking", "venues", "slots"],
    keywords: ["book venue", "book court", "reserve slot", "booking"],
    roles: ["player", "all"],
    relatedArticles: ["find-a-venue", "cancel-a-booking", "payment-flow"],
    order: 3,
    popular: true,
    content: {
      sections: [
        {
          body: "Open a venue → choose sport, facility, date, and time slot → review price (including GST where shown) → continue to payment → confirm.",
        },
        {
          heading: "After payment",
          body: "You receive a booking confirmation and can find the booking under Bookings. You may also get a notification.",
          tip: "Slots may be held briefly while you complete payment. Finish checkout promptly so your slot is not released.",
        },
      ],
    },
  },
];

export const bookingsArticles: HelpArticle[] = [
  {
    id: "booking-history",
    slug: "booking-history",
    title: "Where can I see my bookings?",
    description: "View upcoming and past bookings from the Bookings tab.",
    category: "bookings",
    tags: ["bookings", "history"],
    keywords: ["booking history", "my bookings", "past bookings"],
    roles: ["player", "all"],
    relatedArticles: ["how-to-book-a-venue", "cancel-a-booking"],
    order: 1,
    content: {
      sections: [
        {
          body: "Open the Bookings tab to see upcoming and past bookings. Tap a booking for details, receipts, and cancellation options when available.",
        },
      ],
    },
  },
  {
    id: "cancel-a-booking",
    slug: "cancel-a-booking",
    title: "How do I cancel a booking?",
    description: "Cancel a booking from booking details when cancellation is still allowed.",
    category: "bookings",
    tags: ["cancel", "refund", "bookings"],
    keywords: ["cancel booking", "cancellation", "refund"],
    roles: ["player", "all"],
    relatedArticles: ["booking-history", "payment-flow", "refunds"],
    order: 2,
    popular: true,
    content: {
      sections: [
        {
          body: "Open Bookings → select the booking → Cancel. Cancellation availability and any refund depend on timing and venue or payment rules shown in the app.",
        },
        {
          heading: "Refunds",
          body: "If a refund applies, Sportza processes it through the original payment method where supported. Exact refund amounts and timelines are policy-dependent — check the confirmation screen and any on-screen policy notice.",
          tip: "If you are unsure what happens when you cancel, look for the cancellation notice on the booking detail screen before confirming.",
        },
      ],
    },
  },
];
