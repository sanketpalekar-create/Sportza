import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api", "") ?? "http://localhost:5000";

export interface DisplayPairedPayload {
  matchId: number;
  displayId: number;
  courtName: string;
  sportName: string;
}

interface UsePairingSocketOptions {
  token: string | null;
  onPaired: (payload: DisplayPairedPayload) => void;
}

export function usePairingSocket({ token, onPaired }: UsePairingSocketOptions) {
  const onPairedRef = useRef(onPaired);
  useEffect(() => { onPairedRef.current = onPaired; }, [onPaired]);

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 8000,
    });

    socket.on("connect", () => {
      socket.emit("pairing:join", token);
    });

    socket.on("display:paired", (payload: DisplayPairedPayload) => {
      onPairedRef.current(payload);
      socket.emit("pairing:leave", token);
      socket.disconnect();
    });

    return () => {
      socket.emit("pairing:leave", token);
      socket.disconnect();
    };
  }, [token]);
}
