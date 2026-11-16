import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The one place the version is kept (see bump-version.ps1); shown in the app's "What's new".
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as { version: string };

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the production build works from the Electron
  // app:// protocol (and any non-root host path).
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    open: true,
    // The app reads ../CHANGELOG.md (repo root) for its "What's new" page.
    fs: { allow: [".."] },
  },
});
