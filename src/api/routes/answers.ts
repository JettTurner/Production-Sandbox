import { Hono } from "hono";
import { sessionRepo, answerRepo } from "../../db/index.js";
import { Answer } from "../../core/models/questions.js";

const answers = new Hono();

answers.post("/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const record = sessionRepo.findById(sessionId);
  if (!record) return c.json({ error: "Session not found" }, 404);

  const body = await c.req.json<{
    questionId: string;
    value: string;
    text?: string;
    selectedOptions?: string[];
  }>();

  if (!body.questionId || body.value === undefined) {
    return c.json({ error: "questionId and value are required" }, 400);
  }

  const session = sessionRepo.toSession(record);
  const answer: Answer = {
    questionId: body.questionId,
    value: body.value,
    text: body.text,
    selectedOptions: body.selectedOptions,
  };

  const result = session.processAnswer(answer);
  sessionRepo.update(session);
  answerRepo.create(sessionId, body.questionId, JSON.stringify(body));

  return c.json({
    nextQuestion: result.nextQuestion ? {
      id: result.nextQuestion.id,
      domain: result.nextQuestion.domain,
      type: result.nextQuestion.type,
      text: result.nextQuestion.text,
      options: result.nextQuestion.options,
      scaleMin: result.nextQuestion.scaleMin,
      scaleMax: result.nextQuestion.scaleMax,
      scaleLabels: result.nextQuestion.scaleLabels,
    } : null,
    status: result.status,
    contradictions: result.contradictions,
    completeness: result.completeness,
  });
});

export default answers;
