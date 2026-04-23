import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, ".", "") };
  const allowedHosts = (env.ALLOWED_HOSTS ?? "semesti.plani.dev")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  return {
    plugins: [react()],
    server: {
      host: true,
      allowedHosts,
      port: 3000,
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET ?? "http://localhost:4000",
          changeOrigin: true
        }
      }
    }
  };
});
