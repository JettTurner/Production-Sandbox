import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the production build works from the Electron
  // app:// protocol (and any non-root host path).
  base: "./",
  server: {
    port: 5173,
    open: true,
  },
});