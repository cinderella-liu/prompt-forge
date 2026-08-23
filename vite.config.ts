import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // 网页部署(GitHub Pages)传 BASE_PATH=/prompt-forge/，APK(Capacitor)不传保持 /
  base: process.env.BASE_PATH || "/",
});
