import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiClient, setAuthToken } from "@sportza/api-client";
import { usePushNotifications } from "../hooks/usePushNotifications";

function hasLocalSession(): boolean {
  try {
    const token = localStorage.getItem("auth_token") || localStorage.getItem("sportza_token");
    if (token) return true;
    const raw = localStorage.getItem("sportza_user");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const user = parsed?.user ?? parsed?.data?.user ?? parsed;
    return Boolean(user?.id || user?._id || user?.email || user?.phone);
  } catch {
    return false;
  }
}

function clearLocalSession() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("sportza_user");
  localStorage.removeItem("sportza_token");
  setAuthToken(null);
}

export default function AuthGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  // Register service worker + subscribe to Web Push once the user is authenticated
  usePushNotifications();

  const [sessionState, setSessionState] = useState<"checking" | "ok" | "fail">(() => {
    if (hasLocalSession()) return "ok";
    return "checking";
  });

  useEffect(() => {
    const existingToken = localStorage.getItem("auth_token");
    if (existingToken) {
      setAuthToken(existingToken);
      setSessionState("ok");
      return;
    }

    apiClient
      .post<{ token: string }>("/auth/refresh")
      .then(({ data }) => {
        localStorage.setItem("auth_token", data.token);
        setAuthToken(data.token);
        setSessionState("ok");
      })
      .catch(() => {
        clearLocalSession();
        setSessionState("fail");
      });
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      clearLocalSession();
      navigate("/login", { replace: true });
    }
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [navigate]);

  if (sessionState === "checking") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (sessionState === "fail") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
