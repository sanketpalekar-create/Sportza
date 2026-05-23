/**
 * useVenueOwnerSocket — joins a venue room for real-time booking notifications.
 * Emits toast + invalidates query cache on booking:created / confirmed / cancelled.
 */
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api", "") ?? "http://localhost:5000";

export type BookingEventPayload = {
  bookingId: number;
  venueId: number;
  facilityId: number;
  status: string;
};

export type ToastHandler = (msg: string, type?: "success" | "info" | "warning") => void;

export function useVenueOwnerSocket(
  venueId: number | null | undefined,
  onToast?: ToastHandler
) {
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!venueId) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("venue:join", { venueId });
    });

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["reports", "venue-bookings"] });
      qc.invalidateQueries({ queryKey: ["slots", "venue", venueId] });
    };

    socket.on("booking:created", (payload: BookingEventPayload) => {
      if (payload.venueId !== venueId) return;
      invalidate();
      onToast?.(`New booking #${payload.bookingId} received`, "info");
    });

    socket.on("booking:confirmed", (payload: BookingEventPayload) => {
      if (payload.venueId !== venueId) return;
      invalidate();
      onToast?.(`Booking #${payload.bookingId} confirmed`, "success");
    });

    socket.on("booking:cancelled", (payload: BookingEventPayload) => {
      if (payload.venueId !== venueId) return;
      invalidate();
      onToast?.(`Booking #${payload.bookingId} cancelled`, "warning");
    });

    socket.on("booking:payment_update", (payload: BookingEventPayload) => {
      if (payload.venueId !== venueId) return;
      invalidate();
    });

    return () => {
      socket.emit("venue:leave", venueId);
      socket.disconnect();
    };
  }, [venueId]);
}
