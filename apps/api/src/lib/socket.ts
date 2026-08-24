import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "sportza_dev_secret_change_in_production";

let io: SocketServer | null = null;

function parseAllowedOrigins(raw: string | undefined): (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => void {
  const isDev = process.env.NODE_ENV !== "production";
  const list = (raw ?? "http://localhost:5173").split(",").map((o) => o.trim()).filter(Boolean);
  return (origin, cb) => {
    if (!origin) return cb(null, true);
    if (isDev && /^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
    if (list.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  };
}

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: parseAllowedOrigins(process.env.CLIENT_ORIGIN),
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[socket] client connected: ${socket.id}`);

    // ── Venue owner rooms ─────────────────────────────────────────────────────
    // Client sends { token, venueId } to join a scoped venue room for real-time notifications
    socket.on("venue:join", (payload: { token?: string; venueId: number | string }) => {
      const room = `venue:${payload.venueId}`;
      socket.join(room);
      console.log(`[socket] ${socket.id} joined ${room}`);
      socket.emit("venue:joined", { venueId: payload.venueId, room });
    });

    socket.on("venue:leave", (venueId: number | string) => {
      socket.leave(`venue:${venueId}`);
    });

    // ── Match rooms (live score / scoreboard) ────────────────────
    socket.on("match:join", (matchId: number | string) => {
      const room = `match:${matchId}`;
      socket.join(room);
      console.log(`[socket] ${socket.id} joined ${room}`);
      socket.emit("match:joined", { matchId, room });
    });

    socket.on("match:leave", (matchId: number | string) => {
      const room = `match:${matchId}`;
      socket.leave(room);
      console.log(`[socket] ${socket.id} left ${room}`);
    });

    // ── Live score preview (client → server → other room clients) ────
    // Fired on every tap for instant scoreboard sync, without waiting for
    // the debounced HTTP write to complete and emit match:score.
    socket.on("match:score:preview", (payload: {
      matchId: number | string;
      scores: unknown;
      status?: string;
    }) => {
      // Broadcast to everyone else in the room — excludes the scoring client
      // so LiveMatch doesn't receive its own optimistic update back.
      socket.to(`match:${payload.matchId}`).emit("match:score", {
        matchId: payload.matchId,
        scores: payload.scores,
        winnerTeam: null,
        status: payload.status ?? "live",
      });
    });

    // ── Pairing rooms (TV waiting to be claimed) ─────────────────
    // TV browser joins this room so it can receive the one-shot display:paired event
    socket.on("pairing:join", (token: string) => {
      const room = `pairing:${token}`;
      socket.join(room);
      console.log(`[socket] ${socket.id} joined ${room}`);
      socket.emit("pairing:joined", { token, room });
    });

    socket.on("pairing:leave", (token: string) => {
      socket.leave(`pairing:${token}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[socket] client disconnected: ${socket.id} — ${reason}`);
    });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) {
    throw new Error(
      "Socket.io not initialised. Call initSocket first (local/Docker only; not available on Vercel)."
    );
  }
  return io;
}

/** True when Socket.io was attached to an HTTP server (local / Docker). */
export function isSocketReady(): boolean {
  return io !== null;
}

// Emit to all clients in a live match room
export function emitToMatch(
  matchId: number,
  event: string,
  payload: unknown
): void {
  if (!io) return;
  io.to(`match:${matchId}`).emit(event, payload);
}

// Emit to all clients waiting in a pairing room (TV displays)
export function emitToDisplay(
  token: string,
  event: string,
  payload: unknown
): void {
  if (!io) return;
  io.to(`pairing:${token}`).emit(event, payload);
}

// Broadcast booking lifecycle events — venue-scoped room + global fallback
export function emitBookingEvent(
  event: "booking:created" | "booking:confirmed" | "booking:cancelled" | "booking:payment_update",
  payload: { bookingId: number; venueId: number; facilityId: number; status: string }
): void {
  if (!io) return;
  // Emit to venue-owner room (owners who joined venue:${venueId})
  io.to(`venue:${payload.venueId}`).emit(event, payload);
  // Also emit globally so player UIs still receive their own booking updates
  io.emit(event, payload);
}

// Emit only to a specific venue's owner room (no global broadcast)
export function emitToVenue(
  venueId: number,
  event: string,
  payload: unknown
): void {
  if (!io) return;
  io.to(`venue:${venueId}`).emit(event, payload);
}

// Broadcast open play events
export function emitOpenPlayEvent(
  event: "openplay:joined" | "openplay:left" | "openplay:status_changed",
  payload: { openPlayId: number; userId?: number; playerCount?: number; status?: string }
): void {
  if (!io) return;
  io.emit(event, payload);
}
