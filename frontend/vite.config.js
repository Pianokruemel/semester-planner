import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, ".", "");
    return {
        plugins: [react()],
        server: {
            host: true,
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
