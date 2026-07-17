import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so the dev server is reachable from outside the
    // host machine (e.g. when running on a remote Linux server).
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      // All /api/* requests are proxied to the FastAPI backend.
      // When the frontend is accessed from a remote browser, the proxy runs
      // server-side (Node), so "localhost" here means the server itself — correct.
      "/api": "http://localhost:8000",
    },
  },
});
