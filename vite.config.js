import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      // Same-origin API in development, so the httpOnly refresh cookie works exactly as it will behind Nginx.
      proxy: { "/api": { target: env.VITE_DEV_API_TARGET || "http://localhost:4000", changeOrigin: false } },
    },
  };
});
