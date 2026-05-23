import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api", "") ?? "http://localhost:5000";

export interface MatchScorePayload {
  matchId: number;
  scores: Record<string, unknown>;
  winnerTeam: string | null;
  status: string;
}

export interface MatchEventPayload {
  matchId: number;
  event: {
    id: number;
    team: string;
    eventType: string;
    eventValue: number;
    playerName: string | null;
    eventTimestamp: string;
  };
}

export interface MatchStatusPayload {
  matchId: number;
  status: string;
}

interface UseMatchSocketOptions {
  matchId: number | null;
  onScore?: (payload: MatchScorePayload) => void;
  onEvent?: (payload: MatchEventPayload) => void;
  onStatus?: (payload: MatchStatusPayload) => void;
}

export function useMatchSocket({
  matchId,
  onScore,
  onEvent,
  onStatus,
}: UseMatchSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  // Stable callback refs so we don't re-subscribe on every render
  const onScoreRef = useRef(onScore);
  const onEventRef = useRef(onEvent);
  const onStatusRef = useRef(onStatus);
  useEffect(() => { onScoreRef.current = onScore; }, [onScore]);
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);

  useEffect(() => {
    if (!matchId) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("match:join", matchId);
    });

    socket.on("match:score", (payload: MatchScorePayload) => {
      onScoreRef.current?.(payload);
    });

    socket.on("match:event", (payload: MatchEventPayload) => {
      onEventRef.current?.(payload);
    });

    socket.on("match:status", (payload: MatchStatusPayload) => {
      onStatusRef.current?.(payload);
    });

    socket.on("disconnect", (reason) => {
      // Automatic reconnect handled by socket.io client
      console.debug("[socket] disconnected:", reason);
    });

    return () => {
      socket.emit("match:leave", matchId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [matchId]);

  const isConnected = useCallback(() => socketRef.current?.connected ?? false, []);

  // Emit a live score preview so the scoreboard updates instantly without
  // waiting for the debounced HTTP write + server socket broadcast.
  const emitScorePreview = useCallback((scores: Record<string, unknown>, status = "live") => {
    if (!matchId || !socketRef.current?.connected) return;
    socketRef.current.emit("match:score:preview", { matchId, scores, status });
  }, [matchId]);

  return { isConnected, emitScorePreview };
}
