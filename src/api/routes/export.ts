import { Hono } from "hono";
import { sessionRepo } from "../../db/index.js";
import { ModelBuilder } from "../../core/production/model-builder.js";
import { CompletenessAnalyzer } from "../../core/production/completeness.js";
import { JsonExporter } from "../../core/output/json-exporter.js";
import { MarkdownReportGenerator } from "../../core/output/markdown-report.js";

const exportRoutes = new Hono();

exportRoutes.get("/:sessionId/json", (c) => {
  const record = sessionRepo.findById(c.req.param("sessionId"));
  if (!record) return c.json({ error: "Session not found" }, 404);

  const session = sessionRepo.toSession(record);
  const state = session.getState();
  const model = ModelBuilder.build(session.id, state);

  const summary = state.getSummary();
  const completeness = CompletenessAnalyzer.analyze(
    state.getAllFacts(),
    state.getContradictions(),
    summary.coverageByDomain,
    summary.averageConfidence
  );

  const json = JsonExporter.export(model, completeness);
  return c.json(JSON.parse(json));
});

exportRoutes.get("/:sessionId/markdown", (c) => {
  const record = sessionRepo.findById(c.req.param("sessionId"));
  if (!record) return c.json({ error: "Session not found" }, 404);

  const session = sessionRepo.toSession(record);
  const state = session.getState();
  const model = ModelBuilder.build(session.id, state);

  const summary = state.getSummary();
  const completeness = CompletenessAnalyzer.analyze(
    state.getAllFacts(),
    state.getContradictions(),
    summary.coverageByDomain,
    summary.averageConfidence
  );

  const markdown = MarkdownReportGenerator.generate(model, completeness);
  return c.text(markdown, 200, { "Content-Type": "text/markdown" });
});

exportRoutes.get("/:sessionId/completeness", (c) => {
  const record = sessionRepo.findById(c.req.param("sessionId"));
  if (!record) return c.json({ error: "Session not found" }, 404);

  const session = sessionRepo.toSession(record);
  const state = session.getState();
  const summary = state.getSummary();

  const completeness = CompletenessAnalyzer.analyze(
    state.getAllFacts(),
    state.getContradictions(),
    summary.coverageByDomain,
    summary.averageConfidence
  );

  return c.json(completeness);
});

export default exportRoutes;
