import { useState, useCallback } from "react";
import { useGoogleOneTapLogin, useGoogleLogin } from "@react-oauth/google";
import { useGoogleAuth } from "@sportza/api-client";

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export function isGoogleSignInConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0;
}

export function messageFromGoogleApiError(err: unknown): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (typeof msg === "string" && msg.length > 0) return msg;
  if (err instanceof Error && err.message) return err.message;
  return "Google sign-in failed. Check that the API is running and try again.";
}

/** Shown when Google blocks the popup (e.g. origin_mismatch on mobile / tunnel URLs). */
export function messageForGoogleOriginMismatch(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    `Google blocked sign-in for this site (origin_mismatch). In Google Cloud Console → Credentials → ` +
    `your OAuth Web client, add Authorized JavaScript origin: ${origin}` +
    ` (also add https://sportza.in and https://www.sportza.in for production).`
  );
}

type Options = {
  keepLoggedIn: boolean;
  onSuccess: (result: { token?: string; user?: unknown }) => void;
};

export function useSportzaGoogleSignIn({ keepLoggedIn, onSuccess }: Options) {
  const [googleErr, setGoogleErr] = useState("");
  const googleAuth = useGoogleAuth();
  const configured = isGoogleSignInConfigured();

  const completeGoogleSignIn = useCallback(
    async (payload: { credential?: string; accessToken?: string }) => {
      setGoogleErr("");
      try {
        const result = await googleAuth.mutateAsync({
          ...payload,
          keepLoggedIn,
        });
        const token = result?.token ?? result?.data?.token;
        if (!token) {
          setGoogleErr(
            "Google sign-in did not return a session. Ensure the API is running (port 5000) and GOOGLE_CLIENT_ID is set in apps/api/.env."
          );
          return;
        }
        onSuccess(result);
      } catch (err) {
        setGoogleErr(messageFromGoogleApiError(err));
      }
    },
    [googleAuth, keepLoggedIn, onSuccess]
  );

  useGoogleOneTapLogin({
    disabled: !configured,
    onSuccess: (response) => {
      void completeGoogleSignIn({ credential: response.credential });
    },
    onError: () => {
      // One Tap is often suppressed on localhost / after dismiss — no UI noise
    },
  });

  const startGooglePopup = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      void completeGoogleSignIn({ accessToken: tokenResponse.access_token });
    },
    onError: () => {
      setGoogleErr(messageForGoogleOriginMismatch());
    },
  });

  const openGooglePopup = useCallback(() => {
    if (!configured) {
      setGoogleErr(
        "Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID in apps/web/.env and restart the dev server."
      );
      return;
    }
    setGoogleErr("");
    startGooglePopup();
  }, [configured, startGooglePopup]);

  return {
    googleErr,
    googlePending: googleAuth.isPending,
    openGooglePopup,
    configured,
  };
}
