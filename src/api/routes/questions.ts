import { Hono } from "hono";
import { sessionRepo } from "../../db/index.js";

const questions = new Hono();

questions.get("/:sessionId/next-question", (c) => {
  const record = sessionRepo.findById(c.req.param("sessionId"));
  if (!record) return c.json({ error: "Session not found" }, 404);

  const session = sessionRepo.toSession(record);
  const question = session.getNextQuestion();

  if (!question) {
    return c.json({
      question: null,
      message: "Interview complete. No more questions.",
    });
  }

  return c.json({
    question: {
      id: question.id,
      domain: question.domain,
      type: question.type,
      text: question.text,
      options: question.options,
      scaleMin: question.scaleMin,
      scaleMax: question.scaleMax,
      scaleLabels: question.scaleLabels,
    },
  });
});

export default questions;
