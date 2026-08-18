import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import path from "path";
import { fileURLToPath } from "url";

import sessions from "./routes/sessions.js";
import questions from "./routes/questions.js";
import answers from "./routes/answers.js";
import back from "./routes/back.js";
import exportRoutes from "./routes/export.js";
import { closeDatabase } from "../db/connection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = new Hono();

app.use("/*", cors());

app.route("/api/sessions", sessions);
app.route("/api/sessions", questions);
app.route("/api/sessions", answers);
app.route("/api/sessions", back);
app.route("/api/sessions", exportRoutes);

const staticDir = path.join(__dirname, "../../src/ui");
app.use("/*", serveStatic({ root: staticDir }));

app.get("/", (c) => {
  return c.redirect("/index.html");
});

const port = 3000;

console.log(`Production Sandbox server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});

process.on("SIGINT", () => {
  closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDatabase();
  process.exit(0);
});
