/** Standard JSON envelope from Sportza API routes. */
export type ApiSuccess<T> = { success: boolean; data: T };

export type BookingSplitParticipant = {
  userId: number;
  name: string | null;
  avatar: string | null;
  amount: number;
  status: string;
};

/** Present on GET /bookings/:id for split / open_play when the viewer is allowed to see the booking. */
export type BookingSplitDetails = {
  bookingType: string;
  splitCount?: number | null;
  perPersonAmount: number;
  joinedCount: number;
  paidCount: number;
  pendingCount: number;
  pendingAmount: number;
  confirmThresholdAmount: number;
  amountNeededForConfirm: number;
  thresholdMet: boolean;
  paidPercentOfTotal: number;
  participants: BookingSplitParticipant[];
};

/** Core booking fields returned by GET /bookings/:id (relations vary by route). */
export type BookingRecord = {
  id: number;
  status: string;
  bookingType?: string | null;
  sport?: string | null;
  totalAmount: number;
  subtotal?: number;
  gstAmount?: number;
  paidAmount?: number | null;
  paymentStatus?: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  facilityName?: string | null;
  splitDetails?: BookingSplitDetails;
  venue?: {
    id: number;
    name: string;
    locationCity?: string | null;
    locationAddr?: string | null;
    phone?: string | null;
  };
  payments?: Array<{ id: number; amount: number; status: string; paymentGatewayId?: string | null }>;
};

/** GET /bookings/:id/split-status */
export type SplitBookingStatusData = {
  bookingId: number;
  venue: {
    id: number;
    name: string;
    locationCity: string | null;
    locationAddr: string | null;
  };
  sport: string;
  facilityName: string;
  bookingDate: Date | string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  splitCount: number | null;
  perPersonAmount: number;
  joinedCount: number;
  paidCount: number;
  pendingCount: number;
  currentUserStatus: string;
  pendingAmount: number;
  confirmThresholdAmount: number;
  amountNeededForConfirm: number;
  thresholdMet: boolean;
  paidPercentOfTotal: number;
  participants: Array<{
    userId: number;
    name: string | null;
    avatar: string | null;
    amount: number;
    status: string;
  }>;
};
