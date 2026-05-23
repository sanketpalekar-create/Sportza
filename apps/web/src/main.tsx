import React from "react";
import ReactDOM from "react-dom/client";

// Apply saved theme before first paint to prevent flash
(function () {
  const saved = localStorage.getItem("sportza-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && prefersDark)) {
    document.documentElement.classList.add("dark");
  }
})();
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { setApiBaseUrl } from "@sportza/api-client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { RoleProvider } from "./context/RoleContext";
import { LocationProvider } from "./context/LocationContext";
import { MapsProvider } from "./lib/googleMaps";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
setApiBaseUrl(apiUrl);

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary>
            <RoleProvider>
              <LocationProvider>
                <MapsProvider>
                  <App />
                </MapsProvider>
              </LocationProvider>
            </RoleProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
