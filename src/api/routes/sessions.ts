import { Hono } from "hono";
import { sessionRepo } from "../../db/index.js";
import { InterviewSession } from "../../core/interview/session-manager.js";

const sessions = new Hono();

sessions.get("/", (c) => {
  const records = sessionRepo.findAll();
  return c.json(records.map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })));
});

sessions.post("/", async (c) => {
  const body = await c.req.json<{ name?: string }>();
  const session = new InterviewSession(body.name);
  session.start();
  sessionRepo.create(session);
  return c.json({
    id: session.id,
    name: session.name,
    status: session.getStatus(),
  }, 201);
});

sessions.get("/:id", (c) => {
  const record = sessionRepo.findById(c.req.param("id"));
  if (!record) return c.json({ error: "Session not found" }, 404);
  const session = sessionRepo.toSession(record);
  const result = session.getResult();
  return c.json({
    id: session.id,
    name: session.name,
    status: result.status,
    completeness: result.completeness,
    contradictions: result.contradictions,
    createdAt: session.getCreatedAt(),
    updatedAt: session.getUpdatedAt(),
  });
});

sessions.delete("/:id", (c) => {
  const record = sessionRepo.findById(c.req.param("id"));
  if (!record) return c.json({ error: "Session not found" }, 404);
  sessionRepo.delete(c.req.param("id"));
  return c.json({ success: true });
});

export default sessions;
