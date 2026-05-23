import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./axios-instance";
import type { ApiSuccess, BookingRecord, SplitBookingStatusData } from "./types/booking";
import { clearStoredAuthState } from "./platform-adapter";

// ─── Auth ───────────────────────────────────────────────

export function useCurrentUser(options?: { enabled?: boolean; retry?: boolean | number }) {
  return useQuery<any>({
    queryKey: ["auth", "me"],
    queryFn: () => apiClient.get("/auth/me").then((r) => r.data),
    retry: false,
    ...options,
  });
}

export function useSearchUsers(q: string) {
  return useQuery<any>({
    queryKey: ["users", "search", q],
    queryFn: () => apiClient.get("/auth/users/search", { params: { q } }).then((r) => r.data),
    enabled: q.length >= 2,
  });
}

export function useMyRoles() {
  return useQuery<any>({
    queryKey: ["auth", "roles"],
    queryFn: () => apiClient.get("/auth/me/roles").then((r) => r.data),
    retry: false,
  });
}

export function useSwitchRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (role: string) =>
      apiClient.patch("/auth/me/role", { role }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      qc.invalidateQueries({ queryKey: ["auth", "roles"] });
    },
  });
}

export function useSendOtp() {
  return useMutation({
    mutationFn: (data: string | { email: string; name?: string }) => {
      const payload = typeof data === "string" ? { email: data } : data;
      return apiClient.post("/auth/otp", payload).then((r) => r.data);
    },
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: (data: { email: string; code: string; name?: string; keepLoggedIn?: boolean }) =>
      apiClient.post("/auth/verify-otp", data).then((r) => r.data),
  });
}

export function useSendPhoneOtp() {
  return useMutation({
    mutationFn: (data: { phone: string; name?: string }) =>
      apiClient.post("/auth/phone-otp", data).then((r) => r.data),
  });
}

export function useVerifyPhoneOtp() {
  return useMutation({
    mutationFn: (data: { phone: string; code: string; name?: string; keepLoggedIn?: boolean }) =>
      apiClient.post("/auth/verify-phone-otp", data).then((r) => r.data),
  });
}

export function useSendMagicLink() {
  return useMutation({
    mutationFn: (email: string) => apiClient.post("/auth/magic-link", { email }).then((r) => r.data),
  });
}

export function useLoginWithPassword() {
  return useMutation({
    mutationFn: (data: { identifier: string; password: string; keepLoggedIn?: boolean }) =>
      apiClient.post("/auth/login", data).then((r) => r.data),
  });
}

export function useGoogleAuth() {
  return useMutation({
    mutationFn: (data: { credential?: string; accessToken?: string; keepLoggedIn?: boolean }) =>
      apiClient.post("/auth/google", data).then((r) => r.data),
  });
}

export function useSetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      apiClient.post("/auth/set-password", { password }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth", "me"] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name?: string;
      phone?: string | null;
      avatar?: string | null;
      location?: { country?: string; state: string; city: string; pincode?: string; address?: string; lat?: number; lng?: number } | null;
      sports?: number[] | null;
    }) => apiClient.patch("/auth/me", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete("/auth/me").then((r) => r.data),
    onSuccess: async () => {
      await clearStoredAuthState();
      qc.clear();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (identifier: string) =>
      apiClient.post("/auth/forgot-password", { identifier }).then((r) => r.data),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: { token: string; password: string }) =>
      apiClient.post("/auth/reset-password", data).then((r) => r.data),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post("/auth/logout").then((r) => r.data),
    onSuccess: async () => {
      await clearStoredAuthState();
      qc.clear();
    },
  });
}

// ─── Notifications ──────────────────────────────────────

export function useNotifications(params?: { page?: number; limit?: number }) {
  return useQuery<any>({
    queryKey: ["notifications", params],
    queryFn: () => apiClient.get("/notifications", { params }).then((r) => r.data),
    staleTime: 15_000,
  });
}

export function useUnreadCount() {
  return useQuery<any>({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiClient.get("/notifications/unread-count").then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.patch("/notifications/read-all").then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ─── Venues ─────────────────────────────────────────────

export function useVenues(params?: {
  page?: number;
  limit?: number;
  city?: string;
  sport?: string;
  activityId?: string;
  category?: string;
  ownerId?: number;
}) {
  return useQuery<any>({
    queryKey: ["venues", params],
    queryFn: () => apiClient.get("/venues", { params }).then((r) => r.data),
  });
}

export function useMyVenues() {
  const { data: userRes } = useCurrentUser();
  const userId: number | undefined = (userRes as any)?.user?.id ?? (userRes as any)?.data?.id;
  return useQuery<any>({
    queryKey: ["venues", "mine", userId],
    queryFn: () => apiClient.get("/venues", { params: { ownerId: userId, limit: 50 } }).then((r) => r.data),
    enabled: !!userId,
  });
}

export function useVenueFacilities(venueId: number | null) {
  return useQuery<any>({
    queryKey: ["venues", venueId, "facilities"],
    queryFn: () => apiClient.get(`/venues/${venueId}/facilities`).then((r) => r.data),
    enabled: !!venueId,
  });
}

export function useCreateFacility(venueId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; surfaceType?: string; sports?: string[]; courtCount?: number }) =>
      apiClient.post(`/venues/${venueId}/facilities`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venues", venueId, "facilities"] }),
  });
}

export function useUpdateFacility(venueId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ facilityId, data }: { facilityId: number; data: { name?: string; surfaceType?: string; sports?: string[]; courtCount?: number } }) =>
      apiClient.put(`/venues/${venueId}/facilities/${facilityId}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venues", venueId, "facilities"] }),
  });
}

export function useDeleteFacility(venueId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (facilityId: number) =>
      apiClient.delete(`/venues/${venueId}/facilities/${facilityId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venues", venueId, "facilities"] }),
  });
}

export function useNearbyVenues(params?: {
  lat?: number;
  lng?: number;
  radius?: number;
  sport?: string;
  city?: string;
  state?: string;
}) {
  const hasCoords = !!params?.lat && !!params?.lng;
  const hasCity = !!params?.city;
  return useQuery<any>({
    queryKey: ["venues", "nearby", params],
    queryFn: () => apiClient.get("/venues/nearby", { params }).then((r) => r.data),
    enabled: hasCoords || hasCity,
  });
}

export function useVenue(id: number) {
  return useQuery<any>({
    queryKey: ["venues", id],
    queryFn: () => apiClient.get(`/venues/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => apiClient.post("/venues", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["venues"] }),
  });
}

export function useUpdateVenue(venueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => apiClient.put(`/venues/${venueId}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venues", venueId] });
      qc.invalidateQueries({ queryKey: ["venues"] });
    },
  });
}

export function useVenueReviews(venueId: number) {
  return useQuery<any>({
    queryKey: ["venues", venueId, "reviews"],
    queryFn: () => apiClient.get(`/venues/${venueId}/reviews`).then((r) => r.data),
    enabled: !!venueId,
  });
}

export function useAddVenueReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, ...data }: { venueId: number; rating: number; review?: string }) =>
      apiClient.post(`/venues/${venueId}/reviews`, data).then((r) => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["venues", vars.venueId, "reviews"] }),
  });
}

// ─── Slots ──────────────────────────────────────────────

export function useVenueSlots(venueId: number, params: { date: string; sport?: string }) {
  return useQuery<any>({
    queryKey: ["slots", "venue", venueId, params],
    queryFn: () => apiClient.get(`/slots/venue/${venueId}`, { params }).then((r) => r.data),
    enabled: !!venueId && !!params.date,
  });
}

export function useFacilitySlots(facilityId: number, params: { date: string }) {
  return useQuery<any>({
    queryKey: ["slots", facilityId, params],
    queryFn: () => apiClient.get(`/slots/${facilityId}`, { params }).then((r) => r.data),
    enabled: !!facilityId && !!params.date,
  });
}

export function useHoldSlot() {
  return useMutation({
    mutationFn: (data: {
      facilityId: number;
      venueId: number;
      date: string;
      startTime: string;
      endTime: string;
    }) => apiClient.post("/slots/hold", data).then((r) => r.data),
  });
}

export function useReleaseHold() {
  return useMutation({
    mutationFn: (holdId: number) =>
      apiClient.delete(`/slots/hold/${holdId}`).then((r) => r.data),
  });
}

export function useOwnerBlockedSlots(venueId: number, date: string) {
  return useQuery<any>({
    queryKey: ["slots", "blocks", venueId, date],
    queryFn: () => apiClient.get(`/slots/venue/${venueId}/blocks`, { params: { date } }).then((r) => r.data),
    enabled: !!venueId && !!date,
  });
}

// ─── Bookings ───────────────────────────────────────────

export function useBookings(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery<any>({
    queryKey: ["bookings", params],
    queryFn: () => apiClient.get("/bookings", { params }).then((r) => r.data),
  });
}

export function useBooking(id: number) {
  return useQuery<any>({
    queryKey: ["bookings", id],
    queryFn: () => apiClient.get(`/bookings/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => apiClient.post("/bookings", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useCreateSplitBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      venueId: number;
      sport: string;
      facilityId: number;
      bookingDate: string;
      startTime: string;
      endTime: string;
      splitCount: number;
      addOns?: { addOnId: number; quantity?: number }[];
    }) =>
      apiClient
        .post("/bookings", { ...data, bookingType: "split" })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useSplitBookingStatus(bookingId: number) {
  return useQuery<ApiSuccess<SplitBookingStatusData>>({
    queryKey: ["bookings", bookingId, "split-status"],
    queryFn: () =>
      apiClient.get<ApiSuccess<SplitBookingStatusData>>(`/bookings/${bookingId}/split-status`).then((r) => r.data),
    enabled: !!bookingId,
  });
}

export function useJoinSplitBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: number) =>
      apiClient.post(`/bookings/${bookingId}/split/join`).then((r) => r.data),
    onSuccess: (_, bookingId) => {
      qc.invalidateQueries({ queryKey: ["bookings", bookingId, "split-status"] });
      qc.invalidateQueries({ queryKey: ["bookings", bookingId] });
    },
  });
}

export function useLeaveSplitBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: number) =>
      apiClient.post(`/bookings/${bookingId}/split/leave`).then((r) => r.data),
    onSuccess: (_, bookingId) => {
      qc.invalidateQueries({ queryKey: ["bookings", bookingId, "split-status"] });
      qc.invalidateQueries({ queryKey: ["bookings", bookingId] });
    },
  });
}

export function useInstantBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { facilityId: number; date: string; startTime: string; endTime: string; venueId?: number; sport?: string }) =>
      apiClient.post("/bookings/instant", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useBatchBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      venueId: number;
      sport: string;
      date: string;
      items: { facilityId: number; startTime: string; endTime: string }[];
    }) => apiClient.post("/bookings/batch", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: number) =>
      apiClient.post(`/bookings/${bookingId}/cancel`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

// ─── Payments ───────────────────────────────────────────

export function useCreatePaymentOrder() {
  return useMutation({
    mutationFn: (data: {
      amount: number;
      bookingId?: number;
      groupId?: string;
      currency?: string;
    }) => apiClient.post("/payments/create-order", data).then((r) => r.data),
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiClient.post("/payments/verify", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookings"] }),
  });
}

export function usePaymentHistory(params?: { page?: number; limit?: number }) {
  return useQuery<any>({
    queryKey: ["payments", "history", params],
    queryFn: () => apiClient.get("/payments/history", { params }).then((r) => r.data),
  });
}

// ─── Wallet ─────────────────────────────────────────────

export function useWallet() {
  return useQuery<any>({
    queryKey: ["wallet"],
    queryFn: () => apiClient.get("/wallet").then((r) => r.data),
  });
}

export function useWalletTransactions(params?: { page?: number; limit?: number }) {
  return useQuery<any>({
    queryKey: ["wallet", "transactions", params],
    queryFn: () => apiClient.get("/wallet/transactions", { params }).then((r) => r.data),
  });
}

// ─── Matches ────────────────────────────────────────────

export function useMatches(params?: { sportId?: number; status?: string; userId?: number; page?: number; limit?: number }) {
  return useQuery<any>({
    queryKey: ["matches", params],
    queryFn: () => apiClient.get("/matches", { params }).then((r) => r.data),
  });
}

export function useMyMatchHistory(params?: { page?: number; limit?: number; sportName?: string }) {
  return useQuery<any>({
    queryKey: ["matches", "history", params],
    queryFn: () => apiClient.get("/matches/history", { params }).then((r) => r.data),
  });
}

export function useMatch(id: number, options?: { refetchInterval?: number }) {
  return useQuery<any>({
    queryKey: ["matches", id],
    queryFn: () => apiClient.get(`/matches/${id}`).then((r) => r.data),
    enabled: !!id,
    ...options,
  });
}

export function useCreateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, any>) => apiClient.post("/matches", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
}

export function useUpdateMatchScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; scores: any; winnerTeam?: string }) =>
      apiClient.put(`/matches/${id}/score`, data).then((r) => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["matches", vars.id] }),
  });
}

export function useUpdateMatchStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiClient.put(`/matches/${id}/status`, { status }).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["matches", vars.id] });
      if (vars.status === "completed") {
        qc.invalidateQueries({ queryKey: ["matches", "history"] });
        qc.invalidateQueries({ queryKey: ["stats", "me"] });
      }
    },
  });
}

export function useStartMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.put(`/matches/${id}/start`).then((r) => r.data),
    onSuccess: (_, id) => qc.invalidateQueries({ queryKey: ["matches", id] }),
  });
}

export function useCompleteMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient.put(`/matches/${id}/complete`).then((r) => r.data),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["matches", id] });
      qc.invalidateQueries({ queryKey: ["matches", "history"] });
      qc.invalidateQueries({ queryKey: ["stats", "me"] });
    },
  });
}

export function useAddMatchEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      team,
      eventType,
      eventValue = 1,
      playerId,
      metadata,
    }: {
      id: number;
      team: string;
      eventType: string;
      eventValue?: number;
      playerId?: number;
      metadata?: Record<string, unknown>;
    }) =>
      apiClient
        .post(`/matches/${id}/events`, { team, eventType, eventValue, playerId, metadata })
        .then((r) => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["matches", vars.id] }),
  });
}

// ─── Sports ─────────────────────────────────────────────

export function useSports() {
  return useQuery<any>({
    queryKey: ["sports"],
    queryFn: () => apiClient.get("/sports").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Batches (Training) ────────────────────────────────

export function useBatches(params?: { trainerId?: number; sport?: string; page?: number; limit?: number; city?: string; state?: string }) {
  return useQuery<any>({
    queryKey: ["batches", params],
    queryFn: () => apiClient.get("/batches", { params }).then((r) => r.data),
  });
}

export function useBatch(id: number) {
  return useQuery<any>({
    queryKey: ["batches", id],
    queryFn: () => apiClient.get(`/batches/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useJoinBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: number) => apiClient.post(`/batches/${batchId}/join`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batches", "my"] });
    },
  });
}

export function useMyBatches() {
  return useQuery<any>({
    queryKey: ["batches", "my"],
    queryFn: () => apiClient.get("/batches/my").then((r) => r.data),
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post("/batches", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["trainers", "dashboard"] });
    },
  });
}

export function useBatchAnnouncements(batchId: number) {
  return useQuery<any>({
    queryKey: ["batches", batchId, "announcements"],
    queryFn: () => apiClient.get(`/batches/${batchId}/announcements`).then((r) => r.data),
    enabled: !!batchId,
  });
}

export function usePostBatchAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, message }: { batchId: number; message: string }) =>
      apiClient.post(`/batches/${batchId}/announcements`, { message }).then((r) => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["batches", vars.batchId] });
      qc.invalidateQueries({ queryKey: ["batches", vars.batchId, "announcements"] });
    },
  });
}

export function useBatchSessions(batchId: number, params?: { page?: number; limit?: number }) {
  return useQuery<any>({
    queryKey: ["batches", batchId, "sessions", params],
    queryFn: () => apiClient.get(`/batches/${batchId}/sessions`, { params }).then((r) => r.data),
    enabled: !!batchId,
  });
}

export function useCreateBatchSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, ...data }: { batchId: number; date: string; startTime: string; endTime: string }) =>
      apiClient.post(`/batches/${batchId}/sessions`, data).then((r) => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["batches", vars.batchId, "sessions"] }),
  });
}

export function useUpdateSessionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, status }: { sessionId: number; status: string }) =>
      apiClient.patch(`/batches/sessions/${sessionId}`, { status }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batches"] }),
  });
}

export function useSessionAttendance(sessionId: number) {
  return useQuery<any>({
    queryKey: ["sessions", sessionId, "attendance"],
    queryFn: () => apiClient.get(`/batches/sessions/${sessionId}/attendance`).then((r) => r.data),
    enabled: !!sessionId,
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, attendance }: { sessionId: number; attendance: Array<{ playerId: number; status: string }> }) =>
      apiClient.post(`/batches/sessions/${sessionId}/attendance`, { attendance }).then((r) => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["sessions", vars.sessionId, "attendance"] }),
  });
}

export function useBatchPayments(batchId: number, params?: { page?: number; limit?: number }) {
  return useQuery<any>({
    queryKey: ["batches", batchId, "payments", params],
    queryFn: () => apiClient.get(`/batches/${batchId}/payments`, { params }).then((r) => r.data),
    enabled: !!batchId,
  });
}

export function useRecordBatchPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, ...data }: { batchId: number; payerId: number; amount: number; paymentMode?: string; cycleMonth?: number; cycleYear?: number; playerId?: number }) =>
      apiClient.post(`/batches/${batchId}/payments`, data).then((r) => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["batches", vars.batchId, "payments"] }),
  });
}

export function useBatchReviews(batchId: number) {
  return useQuery<any>({
    queryKey: ["batches", batchId, "reviews"],
    queryFn: () => apiClient.get(`/batches/${batchId}/reviews`).then((r) => r.data),
    enabled: !!batchId,
  });
}

export function useSubmitBatchReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, ...data }: { batchId: number; playerId: number; year: number; month: number; ratings?: Record<string, unknown>; comment?: string }) =>
      apiClient.post(`/batches/${batchId}/reviews`, data).then((r) => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["batches", vars.batchId, "reviews"] }),
  });
}

export function useCreateProgressShareLink() {
  return useMutation({
    mutationFn: ({ batchId, playerId }: { batchId: number; playerId: number }) =>
      apiClient
        .get(`/batches/${batchId}/progress/share-token`, { params: { playerId } })
        .then((r) => r.data),
  });
}

export function usePaymentReminderWhatsApp() {
  return useMutation({
    mutationFn: ({ batchId, playerId }: { batchId: number; playerId: number }) =>
      apiClient.post(`/batches/${batchId}/remind-payment`, { playerId }).then((r) => r.data),
  });
}

export function usePublicPlayerProgress(token: string | null) {
  return useQuery<any>({
    queryKey: ["public", "player-progress", token],
    queryFn: () => apiClient.get("/public/player-progress", { params: { token } }).then((r) => r.data),
    enabled: !!token,
  });
}

export function useGenerateSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, weeks }: { batchId: number; weeks?: number }) =>
      apiClient.post(`/batches/${batchId}/sessions/generate`, { weeks }).then((r) => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["batches", vars.batchId, "sessions"] }),
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: number) =>
      apiClient.delete(`/batches/${batchId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["trainers", "dashboard"] });
    },
  });
}

export function useLeaveBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: number) =>
      apiClient.post(`/batches/${batchId}/leave`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batches"] }),
  });
}

export function useUpdateMemberStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, memberId, status }: { batchId: number; memberId: number; status: "active" | "rejected" }) =>
      apiClient.patch(`/batches/${batchId}/members/${memberId}`, { status }).then((r) => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["batches", vars.batchId] }),
  });
}

export function useAddBatchMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, identifier }: { batchId: number; identifier: string }) =>
      apiClient.post(`/batches/${batchId}/members`, { identifier }).then((r) => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["batches", vars.batchId] }),
  });
}

export function useRateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, rating, comment }: { batchId: number; rating: number; comment?: string }) =>
      apiClient.post(`/batches/${batchId}/rate`, { rating, comment }).then((r) => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["batches", vars.batchId] }),
  });
}

// ─── Trainers ───────────────────────────────────────────

export function useTrainers(params?: { sport?: string; page?: number }) {
  return useQuery<any>({
    queryKey: ["trainers", params],
    queryFn: () => apiClient.get("/trainers", { params }).then((r) => r.data),
  });
}

export function useTrainer(id: number) {
  return useQuery<any>({
    queryKey: ["trainers", id],
    queryFn: () => apiClient.get(`/trainers/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useTrainerDashboard() {
  return useQuery<any>({
    queryKey: ["trainers", "dashboard"],
    queryFn: () => apiClient.get("/trainers/dashboard").then((r) => r.data),
  });
}

export function useTrainerPayments(params?: { page?: number; limit?: number }) {
  return useQuery<any>({
    queryKey: ["trainers", "my", "payments", params],
    queryFn: () => apiClient.get("/trainers/my/payments", { params }).then((r) => r.data),
  });
}

export function useTrainerReviews(trainerId: number) {
  return useQuery<any>({
    queryKey: ["trainers", trainerId, "reviews"],
    queryFn: () => apiClient.get(`/trainers/${trainerId}/reviews`).then((r) => r.data),
    enabled: !!trainerId,
  });
}

// ─── Open Plays ─────────────────────────────────────────

export function useOpenPlays(params?: { sport?: string; status?: string; page?: number }) {
  return useQuery<any>({
    queryKey: ["open-plays", params],
    queryFn: () => apiClient.get("/open-plays", { params }).then((r) => r.data),
  });
}

export function useOpenPlay(id: number) {
  return useQuery<any>({
    queryKey: ["open-plays", id],
    queryFn: () => apiClient.get(`/open-plays/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useJoinOpenPlay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.post(`/open-plays/${id}/join`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["open-plays"] }),
  });
}

export function useLeaveOpenPlay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.post(`/open-plays/${id}/leave`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["open-plays"] }),
  });
}

export function useUpdateOpenPlay(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { bookingDate?: string; startTime?: string; endTime?: string; maxPlayers?: number; title?: string }) =>
      apiClient.patch(`/open-plays/${sessionId}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["open-plays", sessionId] });
      qc.invalidateQueries({ queryKey: ["open-plays"] });
    },
  });
}

export function useRemoveOpenPlayPlayer(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: number) =>
      apiClient.delete(`/open-plays/${sessionId}/players/${targetUserId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["open-plays", sessionId] }),
  });
}

export function useCreateOpenPlay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post("/open-plays", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["open-plays"] }),
  });
}

export function useUpdateOpenPlayStatus(sessionId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) =>
      apiClient.put(`/open-plays/${sessionId}/status`, { status }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["open-plays", sessionId] });
      qc.invalidateQueries({ queryKey: ["open-plays"] });
    },
  });
}

// ─── Stats ──────────────────────────────────────────────

export function usePlayerStats(params?: { sport?: string }) {
  return useQuery<any>({
    queryKey: ["stats", "me", params],
    queryFn: () =>
      apiClient.get("/stats/me", { params }).then((r) => r.data),
  });
}

export function useLeaderboard(params?: { sport?: string; city?: string; state?: string }) {
  return useQuery<any>({
    queryKey: ["stats", "leaderboard", params],
    queryFn: () =>
      apiClient.get("/stats/leaderboard", { params }).then((r) => r.data),
  });
}

// ─── Tournaments ────────────────────────────────────────

export function useTournaments(params?: { sport?: string; status?: string; page?: number }) {
  return useQuery<any>({
    queryKey: ["tournaments", params],
    queryFn: () => apiClient.get("/tournaments", { params }).then((r) => r.data),
  });
}

export function useTournament(id: number) {
  return useQuery<any>({
    queryKey: ["tournaments", id],
    queryFn: () => apiClient.get(`/tournaments/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useTournamentStandings(id: number) {
  return useQuery<any>({
    queryKey: ["tournaments", id, "standings"],
    queryFn: () => apiClient.get(`/tournaments/${id}/standings`).then((r) => r.data),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post("/tournaments", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments"] }),
  });
}

export function useGenerateTournamentFixtures(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stage?: number) =>
      apiClient
        .post(`/tournaments/${tournamentId}/generate-fixtures${stage != null ? `?stage=${stage}` : ""}`)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments", tournamentId] }),
  });
}

export function useAdvanceTournamentStage(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (completedStage: number) =>
      apiClient
        .post(`/tournaments/${tournamentId}/advance-stage`, { completedStage })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments", tournamentId] }),
  });
}

export function useClearTournamentFixtures(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stage?: number) =>
      apiClient.delete(`/tournaments/${id}/fixtures`, { params: stage != null ? { stage } : {} }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments", id] }),
  });
}

export function useUpdateTournament(id: number) {
  const qc = useQueryClient();
  return useMutation<any, Error, Record<string, unknown>>({
    mutationFn: (body) => apiClient.put(`/tournaments/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments", id] }),
  });
}

export function useUpdateTournamentStatus(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) =>
      apiClient.put(`/tournaments/${tournamentId}/status`, { status }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments", tournamentId] }),
  });
}

/**
 * Creates (or retrieves) a Match for a specific tournament fixture.
 * Returns { matchId, existing } — navigate to /matches/:matchId afterward.
 */
export function useStartFixtureMatch(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fixtureId: number) =>
      apiClient
        .post(`/tournaments/${tournamentId}/fixtures/${fixtureId}/start-match`)
        .then((r) => r.data as { success: boolean; matchId: number; existing: boolean }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments", tournamentId] }),
  });
}

// ─── Tournament Registrations ────────────────────────────────────────────────

export function useTournamentRegistrations(tournamentId: number) {
  return useQuery<any>({
    queryKey: ["tournaments", tournamentId, "registrations"],
    queryFn: () => apiClient.get(`/tournaments/${tournamentId}/registrations`).then((r) => r.data),
    enabled: !!tournamentId,
    staleTime: 0,
  });
}

export function useRegisterForTournament(tournamentId: number) {
  return useMutation({
    mutationFn: (data: { teamName: string; captainName: string; captainPhone?: string; notes?: string; playerUsernames?: string[] }) =>
      apiClient.post(`/tournaments/${tournamentId}/register`, data).then((r) => r.data),
  });
}

export function useAcceptRegistration(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamName: string) =>
      apiClient.post(`/tournaments/${tournamentId}/registrations/accept`, { teamName }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournaments", tournamentId, "registrations"] });
    },
  });
}

export function useRejectRegistration(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamName: string) =>
      apiClient.post(`/tournaments/${tournamentId}/registrations/reject`, { teamName }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments", tournamentId, "registrations"] }),
  });
}

// ─── Tournament Players ───────────────────────────────────────────────────────

export function useTournamentTopScorers(tournamentId: number) {
  return useQuery<any>({
    queryKey: ["tournaments", tournamentId, "top-scorers"],
    queryFn: () => apiClient.get(`/tournaments/${tournamentId}/top-scorers`).then((r) => r.data),
    enabled: !!tournamentId,
    staleTime: 0,
  });
}

export function useAddTournamentPlayer(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { teamName: string; playerName: string; jerseyNo?: number; userId?: number; username?: string }) =>
      apiClient.post(`/tournaments/${tournamentId}/players`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournaments", tournamentId, "top-scorers"] });
    },
  });
}

export function useAddTournamentPlayers(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      teamName: string;
      players: Array<{ playerName: string; userId?: number; username?: string; jerseyNo?: number }>;
    }) => apiClient.post(`/tournaments/${tournamentId}/players/bulk`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournaments", tournamentId, "top-scorers"] });
    },
  });
}

export function useRemoveTournamentPlayer(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { teamName: string; playerName: string }) =>
      apiClient.delete(`/tournaments/${tournamentId}/players`, { data }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournaments", tournamentId, "top-scorers"] });
    },
  });
}

export function useUpdatePlayerStats(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { teamName: string; playerName: string; goals?: number; assists?: number; points?: number; stats?: Record<string, number> }) =>
      apiClient.patch(`/tournaments/${tournamentId}/players/stats`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments", tournamentId] });
      qc.invalidateQueries({ queryKey: ["tournaments", tournamentId, "top-scorers"] });
    },
  });
}

// ─── Tournament Sponsors ──────────────────────────────────────────────────────

export function useUpdateTournamentSponsors(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sponsors: { name: string; logoUrl?: string; tier?: string }[]) =>
      apiClient.patch(`/tournaments/${tournamentId}/sponsors`, { sponsors }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments", tournamentId] }),
  });
}

// ─── Tournament Announcements ─────────────────────────────────────────────────

export function useTournamentAnnouncements(tournamentId: number) {
  return useQuery<any>({
    queryKey: ["tournaments", tournamentId, "announcements"],
    queryFn: () => apiClient.get(`/tournaments/${tournamentId}/announcements`).then((r) => r.data),
    enabled: !!tournamentId,
    staleTime: 0,
  });
}

export function usePostTournamentAnnouncement(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; body: string }) =>
      apiClient.post(`/tournaments/${tournamentId}/announcements`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments", tournamentId, "announcements"] }),
  });
}

export function useDeleteTournamentAnnouncement(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (announcementId: number) =>
      apiClient.delete(`/tournaments/${tournamentId}/announcements/${announcementId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tournaments", tournamentId, "announcements"] }),
  });
}

// ─── Reports ────────────────────────────────────────────

export function useRevenueReport(params: { startDate: string; endDate: string; groupBy?: string; venueId?: number }) {
  return useQuery<any>({
    queryKey: ["reports", "revenue", params],
    queryFn: () => apiClient.get("/reports/revenue", { params }).then((r) => r.data),
  });
}

export function useBookingReport(params: { startDate: string; endDate: string; venueId?: number }) {
  return useQuery<any>({
    queryKey: ["reports", "bookings", params],
    queryFn: () => apiClient.get("/reports/bookings", { params }).then((r) => r.data),
  });
}

export function useVenueMonthlyReport(params: { venueId: number; year: number; month: number }) {
  return useQuery<any>({
    queryKey: ["reports", "venues", params.venueId, "monthly", params.year, params.month],
    queryFn: () =>
      apiClient
        .get(`/reports/venues/${params.venueId}/monthly`, { params: { year: params.year, month: params.month } })
        .then((r) => r.data),
    enabled: !!params.venueId,
  });
}

export function useTrainerMonthlyReport(params: { year: number; month: number }) {
  return useQuery<any>({
    queryKey: ["reports", "trainers", "me", "monthly", params.year, params.month],
    queryFn: () =>
      apiClient
        .get("/reports/trainers/me/monthly", { params: { year: params.year, month: params.month } })
        .then((r) => r.data),
  });
}

export function useBatchReviewParameters() {
  return useQuery<any>({
    queryKey: ["batches", "review-parameters"],
    queryFn: () => apiClient.get("/batches/review-parameters").then((r) => r.data),
    staleTime: 1000 * 60 * 60,
  });
}

export function useVenueOwnerBookings(params?: {
  startDate?: string;
  endDate?: string;
  venueId?: number;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const effectiveParams = {
    ...params,
    startDate: params?.startDate ?? defaultStart,
    endDate: params?.endDate ?? defaultEnd,
  };
  return useQuery<any>({
    queryKey: ["reports", "venue-bookings", effectiveParams],
    queryFn: () => apiClient.get("/reports/venue-bookings", { params: effectiveParams }).then((r) => r.data),
    staleTime: 30_000,
  });
}

// ─── Trainings (Discovery) ─────────────────────────────

export function useTrainingDiscovery(params?: { sport?: string; city?: string }) {
  return useQuery<any>({
    queryKey: ["trainings", params],
    queryFn: () => apiClient.get("/trainings", { params }).then((r) => r.data),
  });
}

export function useTrainingBatch(id: number) {
  return useQuery<any>({
    queryKey: ["trainings", id],
    queryFn: () => apiClient.get(`/trainings/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

// ─── Displays / Court Pairing ────────────────────────────

export function useVenueDisplays(venueId: number | null) {
  return useQuery<any>({
    queryKey: ["displays", venueId],
    queryFn: () => apiClient.get("/displays", { params: { venueId } }).then((r) => r.data),
    enabled: !!venueId,
  });
}

export function useCreateDisplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { venueId: number; courtName: string }) =>
      apiClient.post("/displays", data).then((r) => r.data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["displays", vars.venueId] }),
  });
}

export function useDeleteDisplay(venueId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (displayId: number) =>
      apiClient.delete(`/displays/${displayId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["displays", venueId] }),
  });
}

export function useGeneratePairing(venueId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (displayId: number) =>
      apiClient.post(`/displays/${displayId}/pair`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["displays", venueId] }),
  });
}

export function usePairingStatus(token: string | null) {
  return useQuery<any>({
    queryKey: ["pairing", token],
    queryFn: () => apiClient.get(`/displays/pairing/${token}`).then((r) => r.data),
    enabled: !!token,
    retry: false,
    refetchInterval: false,
  });
}

export function useClaimDisplay(token: string | null) {
  return useMutation({
    mutationFn: (matchId: number) =>
      apiClient.post(`/displays/claim/${token}`, { matchId }).then((r) => r.data),
  });
}

// ─── Matchmaking & Skill Rating ─────────────────────────────

export function useMatchmakingSuggestions(params?: { sport?: string; sportId?: number }) {
  return useQuery<any>({
    queryKey: ["matchmaking", "suggestions", params],
    queryFn: () =>
      apiClient.get("/matchmaking/suggestions", { params }).then((r) => r.data),
  });
}

export function useMySkillRatings() {
  return useQuery<any>({
    queryKey: ["matchmaking", "skill-rating", "me"],
    queryFn: () => apiClient.get("/matchmaking/skill-rating").then((r) => r.data),
  });
}

export function usePlayerSkillRating(userId: number | null) {
  return useQuery<any>({
    queryKey: ["matchmaking", "skill-rating", userId],
    queryFn: () => apiClient.get(`/matchmaking/skill-rating/${userId}`).then((r) => r.data),
    enabled: !!userId,
  });
}

export function useRatingHistory(params?: { sportId?: number; limit?: number }) {
  return useQuery<any>({
    queryKey: ["matchmaking", "rating-history", params],
    queryFn: () =>
      apiClient.get("/matchmaking/rating-history", { params }).then((r) => r.data),
  });
}

export function usePlayerNetwork() {
  return useQuery<any>({
    queryKey: ["matchmaking", "network"],
    queryFn: () => apiClient.get("/matchmaking/network").then((r) => r.data),
  });
}

export function useInitializeRatings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sportIds: number[]) =>
      apiClient.post("/matchmaking/initialize-ratings", { sportIds }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matchmaking", "skill-rating"] });
      queryClient.invalidateQueries({ queryKey: ["matchmaking", "suggestions"] });
    },
  });
}

// ─── Peer Invites ─────────────────────────────────────────────

export function useCreatePeerInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      receiverId: number;
      sportId: number;
      message?: string;
      proposedDate?: string;
      proposedStartTime?: string;
      proposedEndTime?: string;
    }) => apiClient.post("/peer-invites", data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peer-invites", "received"] });
      queryClient.invalidateQueries({ queryKey: ["peer-invites", "sent"] });
    },
  });
}

export function useReceivedPeerInvites(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery<any>({
    queryKey: ["peer-invites", "received", params],
    queryFn: () => apiClient.get("/peer-invites/received", { params }).then((r) => r.data),
  });
}

export function useSentPeerInvites(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery<any>({
    queryKey: ["peer-invites", "sent", params],
    queryFn: () => apiClient.get("/peer-invites/sent", { params }).then((r) => r.data),
  });
}

export function usePeerInvite(inviteId: number | null) {
  return useQuery<any>({
    queryKey: ["peer-invites", "detail", inviteId],
    queryFn: () => apiClient.get(`/peer-invites/${inviteId}`).then((r) => r.data),
    enabled: !!inviteId,
  });
}

export function useRespondToPeerInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ inviteId, status }: { inviteId: number; status: "accepted" | "declined" }) =>
      apiClient.patch(`/peer-invites/${inviteId}/respond`, { status }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peer-invites", "received"] });
      queryClient.invalidateQueries({ queryKey: ["peer-invites", "sent"] });
    },
  });
}

export function useCancelPeerInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: number) =>
      apiClient.patch(`/peer-invites/${inviteId}/cancel`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["peer-invites", "received"] });
      queryClient.invalidateQueries({ queryKey: ["peer-invites", "sent"] });
    },
  });
}

// ─── Venue Owner Booking Mutations ──────────────────────────────────────────

export function useOwnerCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: number; reason?: string }) =>
      apiClient.post(`/bookings/${bookingId}/owner-cancel`, { reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["reports", "venue-bookings"] });
    },
  });
}

export function useOwnerConfirmBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: number) =>
      apiClient.post(`/bookings/${bookingId}/owner-confirm`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["reports", "venue-bookings"] });
    },
  });
}

export function useBlockSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      venueId: number;
      facilityId: number;
      date: string;
      startTime: string;
      endTime: string;
      reason?: string;
    }) => apiClient.post("/slots/block", data).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["slots", "venue", vars.venueId] });
      qc.invalidateQueries({ queryKey: ["slots", "blocks", vars.venueId] });
    },
  });
}

export function useUnblockSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slotId, venueId }: { slotId: number; venueId: number }) =>
      apiClient.delete(`/slots/block/${slotId}`).then((r) => r.data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["slots", "venue", vars.venueId] });
      qc.invalidateQueries({ queryKey: ["slots", "blocks", vars.venueId] });
    },
  });
}

export function useCreateManualBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      venueId: number;
      facilityId: number;
      date: string;
      startTime: string;
      endTime: string;
      sport: string;
      customerName: string;
      customerPhone?: string;
      paymentMethod: "cash" | "upi" | "card";
      amount?: number;
    }) => apiClient.post("/bookings/manual", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", "venue-bookings"] });
      qc.invalidateQueries({ queryKey: ["slots"] });
    },
  });
}

// ─── Facility Schedules ──────────────────────────────────────────────────────

export type BreakTime = { start: string; end: string };
export type DaySchedule = {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  slotDuration: number;
  breakTimes: BreakTime[];
};

const SCHEDULE_KEY = (facilityId: number) => ["schedules", "facility", facilityId];

export function useFacilitySchedule(facilityId: number | null) {
  return useQuery<any>({
    queryKey: SCHEDULE_KEY(facilityId ?? 0),
    queryFn: () => apiClient.get(`/schedules/facility/${facilityId}`).then((r) => r.data),
    enabled: !!facilityId,
  });
}

export function useVenueSchedules(venueId: number | null) {
  return useQuery<any>({
    queryKey: ["schedules", "venue", venueId],
    queryFn: () => apiClient.get(`/schedules/venue/${venueId}`).then((r) => r.data),
    enabled: !!venueId,
  });
}

export function useSchedulePreview(facilityId: number | null, date: string | null) {
  return useQuery<any>({
    queryKey: ["schedules", "preview", facilityId, date],
    queryFn: () =>
      apiClient.get(`/schedules/facility/${facilityId}/preview`, { params: { date } }).then((r) => r.data),
    enabled: !!facilityId && !!date,
    staleTime: 30_000,
  });
}

export function useFacilityExceptions(facilityId: number | null, startDate?: string, endDate?: string) {
  return useQuery<any>({
    queryKey: ["schedules", "exceptions", facilityId, startDate, endDate],
    queryFn: () =>
      apiClient
        .get(`/schedules/facility/${facilityId}/exceptions`, { params: { startDate, endDate } })
        .then((r) => r.data),
    enabled: !!facilityId,
  });
}

export function useUpsertWeeklySchedule(facilityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days: DaySchedule[]) =>
      apiClient.put(`/schedules/facility/${facilityId}`, days).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCHEDULE_KEY(facilityId) });
      qc.invalidateQueries({ queryKey: ["slots"] });
      qc.invalidateQueries({ queryKey: ["schedules", "preview", facilityId] });
    },
  });
}

export function usePatchDaySchedule(facilityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ day, patch }: { day: number; patch: Partial<Omit<DaySchedule, "dayOfWeek">> }) =>
      apiClient.patch(`/schedules/facility/${facilityId}/day/${day}`, patch).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCHEDULE_KEY(facilityId) });
      qc.invalidateQueries({ queryKey: ["slots"] });
    },
  });
}

export function useAddScheduleException(facilityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      startDate: string;
      endDate: string;
      type: "holiday" | "event" | "maintenance" | "custom_hours";
      label?: string;
      isFullBlock?: boolean;
      customOpen?: string;
      customClose?: string;
      reason?: string;
    }) =>
      apiClient.post(`/schedules/facility/${facilityId}/exceptions`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules", "exceptions", facilityId] });
      qc.invalidateQueries({ queryKey: ["slots"] });
    },
  });
}

export function useDeleteScheduleException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exceptionId: number) =>
      apiClient.delete(`/schedules/exceptions/${exceptionId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules", "exceptions"] });
      qc.invalidateQueries({ queryKey: ["slots"] });
    },
  });
}

export function useBulkBlockSchedule(facilityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      ranges: Array<{ startDate: string; endDate: string }>;
      label?: string;
      reason?: string;
      type?: "holiday" | "event" | "maintenance" | "custom_hours";
    }) =>
      apiClient.post(`/schedules/facility/${facilityId}/bulk-block`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules", "exceptions", facilityId] });
      qc.invalidateQueries({ queryKey: ["slots"] });
    },
  });
}

export function useCopySchedule(facilityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetFacilityIds: number[]) =>
      apiClient.post(`/schedules/facility/${facilityId}/copy-to`, { targetFacilityIds }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["slots"] });
    },
  });
}

// ─── Peer Relationships ────────────────────────────────────────────────────────

export function usePeerRelationshipStatus(userId: number | null) {
  return useQuery<any>({
    queryKey: ["peers", "status", userId],
    queryFn: () => apiClient.get(`/peers/status/${userId}`).then((r) => r.data),
    enabled: !!userId,
  });
}

export function usePeerList() {
  return useQuery<any>({
    queryKey: ["peers", "list"],
    queryFn: () => apiClient.get("/peers").then((r) => r.data),
  });
}

export function usePeerSuggestions(params?: { city?: string; state?: string; limit?: number }) {
  return useQuery<any>({
    queryKey: ["peers", "suggestions", params],
    queryFn: () => apiClient.get("/peers/suggestions", { params }).then((r) => r.data),
    enabled: !!(params?.city || params?.state),
  });
}

export function useSendPeerRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { addresseeId: number }) =>
      apiClient.post("/peers/request", data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["peers", "status", variables.addresseeId] });
      qc.invalidateQueries({ queryKey: ["peers", "list"] });
    },
  });
}

export function useRespondToPeerRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: "accept" | "decline" | "remove" }) =>
      apiClient.patch(`/peers/${id}`, { action }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["peers"] });
    },
  });
}

export function usePeerCompare(peerId: number | null) {
  return useQuery<any>({
    queryKey: ["peers", "compare", peerId],
    queryFn: () => apiClient.get(`/peers/compare/${peerId}`).then((r) => r.data),
    enabled: !!peerId,
    retry: false,
  });
}

// ─── Notification Preferences ────────────────────────────────────────────────

export interface NotifPrefsData {
  id: number;
  userId: number;
  emailBookings: boolean;
  emailMatches:  boolean;
  emailPromo:    boolean;
  pushBookings:  boolean;
  pushMatches:   boolean;
  pushInvites:   boolean;
  pushBatch:     boolean;
  pushWallet:    boolean;
}

export function useNotifPrefs() {
  return useQuery<{ success: boolean; data: NotifPrefsData }>({
    queryKey: ["notification-preferences"],
    queryFn: () => apiClient.get("/notification-preferences").then((r) => r.data),
    retry: false,
  });
}

export function useUpdateNotifPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<Omit<NotifPrefsData, "id" | "userId">>) =>
      apiClient.patch("/notification-preferences", updates).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}

// ─── Web Push Subscriptions ─────────────────────────────────────────────────

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Save a browser PushSubscription to the backend (upsert — safe to call repeatedly). */
export function useRegisterPushSubscription() {
  return useMutation<any, Error, PushSubscriptionPayload>({
    mutationFn: (payload) =>
      apiClient.post("/push-subscriptions", payload).then((r) => r.data),
  });
}

/** Remove a push subscription from the backend (e.g. when the user disables notifications). */
export function useUnregisterPushSubscription() {
  return useMutation<any, Error, { endpoint: string }>({
    mutationFn: (payload) =>
      apiClient.delete("/push-subscriptions", { data: payload }).then((r) => r.data),
  });
}

// ─── Admin API ───────────────────────────────────────────────────────────────

export function useAdminStats() {
  return useQuery<any>({
    queryKey: ["admin", "stats"],
    queryFn: () => apiClient.get("/admin/stats").then((r) => r.data),
  });
}

// Users
export function useAdminUsers(params?: { q?: string; role?: string; status?: string; page?: number }) {
  return useQuery<any>({
    queryKey: ["admin", "users", params],
    queryFn: () => apiClient.get("/admin/users", { params }).then((r) => r.data),
  });
}

export function useAdminUser(id: number | undefined) {
  return useQuery<any>({
    queryKey: ["admin", "users", id],
    queryFn: () => apiClient.get(`/admin/users/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useAdminChangeRole() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number; role: string; reason?: string }>({
    mutationFn: ({ id, ...data }) => apiClient.patch(`/admin/users/${id}/role`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
  });
}

export function useAdminSuspendUser() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number; reason: string }>({
    mutationFn: ({ id, reason }) => apiClient.patch(`/admin/users/${id}/suspend`, { reason }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
  });
}

export function useAdminActivateUser() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number }>({
    mutationFn: ({ id }) => apiClient.patch(`/admin/users/${id}/activate`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "users"] }); },
  });
}

// Onboarding
export function useAdminOnboarding(params?: { status?: string; role?: string; page?: number }) {
  return useQuery<any>({
    queryKey: ["admin", "onboarding", params],
    queryFn: () => apiClient.get("/admin/onboarding", { params }).then((r) => r.data),
  });
}

export function useAdminApproveTrainer() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number; note?: string }>({
    mutationFn: ({ id, ...data }) => apiClient.post(`/admin/onboarding/${id}/approve-trainer`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "onboarding"] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useAdminApproveOwner() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number; note?: string }>({
    mutationFn: ({ id, ...data }) => apiClient.post(`/admin/onboarding/${id}/approve-owner`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "onboarding"] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useAdminRejectOnboarding() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number; reason: string }>({
    mutationFn: ({ id, reason }) => apiClient.post(`/admin/onboarding/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "onboarding"] }); },
  });
}

export function useAdminOffboardUser() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number; reason: string }>({
    mutationFn: ({ id, reason }) => apiClient.post(`/admin/onboarding/${id}/offboard`, { reason }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); },
  });
}

// Venues
export function useAdminVenues(params?: { q?: string; status?: string; city?: string; page?: number }) {
  return useQuery<any>({
    queryKey: ["admin", "venues", params],
    queryFn: () => apiClient.get("/admin/venues", { params }).then((r) => r.data),
  });
}

export function useAdminVenue(id: number | undefined) {
  return useQuery<any>({
    queryKey: ["admin", "venues", id],
    queryFn: () => apiClient.get(`/admin/venues/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useAdminActivateVenue() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number }>({
    mutationFn: ({ id }) => apiClient.patch(`/admin/venues/${id}/activate`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "venues"] }); },
  });
}

export function useAdminDeactivateVenue() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number; reason?: string }>({
    mutationFn: ({ id, ...data }) => apiClient.patch(`/admin/venues/${id}/deactivate`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "venues"] }); },
  });
}

export function useAdminReassignVenueOwner() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number; ownerId: number }>({
    mutationFn: ({ id, ...data }) => apiClient.patch(`/admin/venues/${id}/owner`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "venues"] }); },
  });
}

// Ledger
export function useAdminLedger(params?: { userId?: number; type?: string; page?: number }) {
  return useQuery<any>({
    queryKey: ["admin", "ledger", params],
    queryFn: () => apiClient.get("/admin/ledger", { params }).then((r) => r.data),
  });
}

export function useAdminUserWallet(userId: number | undefined) {
  return useQuery<any>({
    queryKey: ["admin", "ledger", "user", userId],
    queryFn: () => apiClient.get(`/admin/ledger/${userId}`).then((r) => r.data),
    enabled: !!userId,
  });
}

export function useAdminWalletAdjust() {
  const qc = useQueryClient();
  return useMutation<any, Error, { userId: number; type: "credit" | "debit"; amount: number; description: string; reason: string }>({
    mutationFn: (data) => apiClient.post("/admin/ledger/adjust", data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "ledger"] }); },
  });
}

// Audit & Approvals
export function useAdminAuditLog(params?: { action?: string; actorId?: number; page?: number }) {
  return useQuery<any>({
    queryKey: ["admin", "audit", params],
    queryFn: () => apiClient.get("/admin/audit", { params }).then((r) => r.data),
  });
}

export function useAdminApprovals(params?: { status?: string; page?: number }) {
  return useQuery<any>({
    queryKey: ["admin", "approvals", params],
    queryFn: () => apiClient.get("/admin/audit/approvals", { params }).then((r) => r.data),
  });
}

export function useAdminApproveRequest() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number; reviewNote?: string }>({
    mutationFn: ({ id, ...data }) => apiClient.post(`/admin/audit/approvals/${id}/approve`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); },
  });
}

export function useAdminRejectRequest() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number; reviewNote: string }>({
    mutationFn: ({ id, ...data }) => apiClient.post(`/admin/audit/approvals/${id}/reject`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); },
  });
}

// ─── Tournament Co-organizer hooks ────────────────────────────────────────────

export function useTournamentCoOrganizers(id: number) {
  return useQuery<any>({
    queryKey: ["tournaments", id, "co-organizers"],
    queryFn: () => apiClient.get(`/tournaments/${id}/co-organizers`).then((r) => r.data),
    enabled: id > 0,
  });
}

export function useAddCoOrganizer(id: number) {
  const qc = useQueryClient();
  return useMutation<any, Error, { userId: number; role: "manager" | "scorer" }>({
    mutationFn: (data) => apiClient.post(`/tournaments/${id}/co-organizers`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments", id] });
      qc.invalidateQueries({ queryKey: ["tournaments", id, "co-organizers"] });
    },
  });
}

export function useUpdateCoOrganizerRole(id: number) {
  const qc = useQueryClient();
  return useMutation<any, Error, { userId: number; role: "manager" | "scorer" }>({
    mutationFn: ({ userId, role }) =>
      apiClient.patch(`/tournaments/${id}/co-organizers/${userId}`, { role }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments", id] });
      qc.invalidateQueries({ queryKey: ["tournaments", id, "co-organizers"] });
    },
  });
}

export function useRemoveCoOrganizer(id: number) {
  const qc = useQueryClient();
  return useMutation<any, Error, { userId: number }>({
    mutationFn: ({ userId }) =>
      apiClient.delete(`/tournaments/${id}/co-organizers/${userId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments", id] });
      qc.invalidateQueries({ queryKey: ["tournaments", id, "co-organizers"] });
    },
  });
}

export function useSaveGroupAssignments(id: number) {
  const qc = useQueryClient();
  return useMutation<any, Error, { assignments: Array<{ name: string; groupIndex: number }> }>({
    mutationFn: (data) =>
      apiClient.patch(`/tournaments/${id}/group-assignments`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments", id] });
    },
  });
}

export function useClearGroupAssignments(id: number) {
  const qc = useQueryClient();
  return useMutation<any, Error, void>({
    mutationFn: () =>
      apiClient.delete(`/tournaments/${id}/group-assignments`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments", id] });
    },
  });
}
