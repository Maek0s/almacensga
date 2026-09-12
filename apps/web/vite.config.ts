import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? "/",
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["almacensga.es"],
    proxy: {
      "/api": {
        target: process.env.API_PROXY ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
