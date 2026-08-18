import { Hono } from "hono";
import { sessionRepo } from "../../db/index.js";

const back = new Hono();

back.post("/:sessionId/back", (c) => {
  const sessionId = c.req.param("sessionId");
  const record = sessionRepo.findById(sessionId);
  if (!record) return c.json({ error: "Session not found" }, 404);

  const session = sessionRepo.toSession(record);
  const result = session.goBack();

  if (!result) {
    return c.json({ error: "Cannot go back" }, 400);
  }

  sessionRepo.update(session);

  const nextQuestion = session.getNextQuestion();
  const summary = session.getState().getSummary();

  return c.json({
    question: {
      id: result.question.id,
      domain: result.question.domain,
      type: result.question.type,
      text: result.question.text,
      options: result.question.options,
      scaleMin: result.question.scaleMin,
      scaleMax: result.question.scaleMax,
      scaleLabels: result.question.scaleLabels,
    },
    previousAnswer: result.answer,
    nextQuestion: nextQuestion ? {
      id: nextQuestion.id,
      domain: nextQuestion.domain,
      type: nextQuestion.type,
      text: nextQuestion.text,
      options: nextQuestion.options,
      scaleMin: nextQuestion.scaleMin,
      scaleMax: nextQuestion.scaleMax,
      scaleLabels: nextQuestion.scaleLabels,
    } : null,
    canGoBack: session.canGoBack(),
    completeness: {
      totalFacts: summary.totalFacts,
      averageConfidence: summary.averageConfidence,
      coverage: summary.coverageByDomain,
    },
  });
});

export default back;
