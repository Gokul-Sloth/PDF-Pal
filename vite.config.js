import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { target: "esnext", outDir: 'dist' },
  base: process.env.VITE_BASE_PATH || "/PDF-Pal/",
  worker: { format: 'es' },
});
