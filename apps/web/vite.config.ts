import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Proxy target is always the local API server.
  // If VITE_API_URL is a full URL, derive the origin from it.
  // If it's a relative path (e.g. "/api"), fall back to localhost:5000.
  const rawApiUrl = env.VITE_API_URL || "http://localhost:5000";
  const apiTarget = rawApiUrl.startsWith("http")
    ? rawApiUrl.replace(/\/api$/, "")
    : "http://localhost:5000";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        // Resolve workspace package directly from source so adding new hooks
        // never requires a manual `pnpm build` + cache-clear cycle.
        "@sportza/api-client": path.resolve(__dirname, "../../packages/api-client/src/index.ts"),
      },
    },
    server: {
      port: 5173,
      // Bind to all interfaces so ngrok / cloudflared can reach the dev server
      host: "0.0.0.0",
      // Allow any external hostname (ngrok, cloudflared, etc.) — Vite 6 requires boolean true
      allowedHosts: true,
      proxy: {
        // Only active when making relative /api calls (useful for SSR or testing)
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      // Generate source maps for production debugging (disable if bundle size matters)
      sourcemap: false,
      // Split vendor chunks for better caching
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            router: ["react-router-dom"],
            query: ["@tanstack/react-query"],
            charts: ["chart.js", "react-chartjs-2"],
          },
        },
      },
    },
  };
});
