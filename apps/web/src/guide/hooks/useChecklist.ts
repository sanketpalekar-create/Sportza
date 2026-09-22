import { useMemo } from "react";
import {
  useBookings,
  useCurrentUser,
  useMatches,
  useMyBatches,
} from "@sportza/api-client";

export type ChecklistItemId =
  | "profile"
  | "sports"
  | "find-venue"
  | "book"
  | "open-play"
  | "training"
  | "match"
  | "stats";

export interface ChecklistItem {
  id: ChecklistItemId;
  label: string;
  to: string;
  done: boolean;
  guideId?: string;
}

export function useChecklist(): {
  items: ChecklistItem[];
  completedCount: number;
  total: number;
  isLoading: boolean;
} {
  const { data: meRes, isLoading: userLoading } = useCurrentUser({ retry: false });
  const user = meRes?.data ?? meRes?.user ?? meRes;
  const { data: bookingsRes, isLoading: bookingsLoading } = useBookings({ limit: 5 });
  const { data: batchesRes } = useMyBatches();
  const { data: matchesRes } = useMatches({ limit: 5 });

  const bookings = normalizeList(bookingsRes);
  const batches = normalizeList(batchesRes);
  const matches = normalizeList(matchesRes);

  const sports = Array.isArray(user?.sports)
    ? user.sports
    : user?.sports
      ? Object.keys(user.sports)
      : [];

  const statsVisited =
    typeof window !== "undefined" && localStorage.getItem("sportza_stats_visited") === "1";
  const venueVisited =
    typeof window !== "undefined" && localStorage.getItem("sportza_venue_visited") === "1";
  const joinedOpenPlay =
    typeof window !== "undefined" && localStorage.getItem("sportza_open_play_joined") === "1";

  const items: ChecklistItem[] = useMemo(
    () => [
      {
        id: "profile",
        label: "Complete your profile",
        to: "/profile/edit",
        done: !!(user?.name && (user?.avatar || user?.phone || user?.locationId)),
      },
      {
        id: "sports",
        label: "Select your sports",
        to: "/profile/edit",
        done: sports.length > 0,
      },
      {
        id: "find-venue",
        label: "Find a venue",
        to: "/venues",
        done: venueVisited || bookings.length > 0,
        guideId: "venue-booking",
      },
      {
        id: "book",
        label: "Book your first game",
        to: "/venues",
        done: bookings.length > 0,
        guideId: "venue-booking",
      },
      {
        id: "open-play",
        label: "Join an Open Play",
        to: "/open-plays",
        done: joinedOpenPlay,
        guideId: "open-play",
      },
      {
        id: "training",
        label: "Join a training session",
        to: "/training",
        done: batches.length > 0,
        guideId: "training",
      },
      {
        id: "match",
        label: "Record your first match",
        to: "/matches",
        done: matches.length > 0,
        guideId: "match",
      },
      {
        id: "stats",
        label: "Check your stats",
        to: "/stats",
        done: statsVisited || matches.length > 0,
        guideId: "stats",
      },
    ],
    [
      user?.name,
      user?.avatar,
      user?.phone,
      user?.locationId,
      sports.length,
      venueVisited,
      bookings.length,
      joinedOpenPlay,
      batches.length,
      matches.length,
      statsVisited,
    ]
  );

  const completedCount = items.filter((i) => i.done).length;

  return {
    items,
    completedCount,
    total: items.length,
    isLoading: userLoading || bookingsLoading,
  };
}

function normalizeList(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.items)) return res.items;
  if (Array.isArray(res.bookings)) return res.bookings;
  if (Array.isArray(res.matches)) return res.matches;
  if (Array.isArray(res.batches)) return res.batches;
  return [];
}
