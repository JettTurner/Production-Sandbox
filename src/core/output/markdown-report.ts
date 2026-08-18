import { ProductionModel } from "../models/production-model.js";
import { CompletenessReport } from "../production/completeness.js";

export class MarkdownReportGenerator {
  static generate(model: ProductionModel, completeness?: CompletenessReport): string {
    const lines: string[] = [];

    lines.push("# Production Model");
    lines.push("");
    lines.push(`> Generated: ${model.meta.generatedAt}`);
    lines.push(`> Coverage: ${(model.meta.coverage * 100).toFixed(1)}% | Confidence: ${(model.meta.confidence * 100).toFixed(1)}%`);

    if (completeness) {
      lines.push(`> Ready for Design: ${completeness.isReadyForDesign ? "Yes" : "No"}`);
    }

    lines.push("");

    lines.push("## Work");
    lines.push("");
    if (model.work.primaryUnits.length > 0) {
      lines.push(`**Primary Units:** ${model.work.primaryUnits.join(", ")}`);
    }
    if (model.work.types.length > 0) {
      lines.push(`**Work Types:** ${model.work.types.join(", ")}`);
    }
    if (model.work.scale !== "unknown") {
      lines.push(`**Scale:** ${model.work.scale}`);
    }
    lines.push("");

    lines.push("## People");
    lines.push("");
    if (model.people.count !== "unknown") {
      lines.push(`**Count:** ${model.people.count}`);
    }
    if (model.people.roles.length > 0) {
      lines.push(`**Roles:** ${model.people.roles.join(", ")}`);
    }
    if (model.people.responsibilities.length > 0) {
      lines.push(`**Responsibilities:** ${model.people.responsibilities.join(", ")}`);
    }
    lines.push("");

    lines.push("## Relationships");
    lines.push("");
    if (model.relationships.entities.length > 0) {
      lines.push(`**Entities:** ${model.relationships.entities.join(", ")}`);
    }
    if (model.relationships.connections.length > 0) {
      lines.push("");
      lines.push("| From | To | Type |");
      lines.push("|------|-----|------|");
      for (const conn of model.relationships.connections) {
        lines.push(`| ${conn.from} | ${conn.to} | ${conn.type} |`);
      }
    }
    lines.push("");

    lines.push("## Flow");
    lines.push("");
    if (model.flow.pattern !== "unknown") {
      lines.push(`**Pattern:** ${model.flow.pattern}`);
    }
    if (model.flow.handoffs.length > 0) {
      lines.push(`**Handoffs:** ${model.flow.handoffs.join("; ")}`);
    }
    if (model.flow.boundaries.length > 0) {
      lines.push(`**Boundaries:** ${model.flow.boundaries.join("; ")}`);
    }
    lines.push("");

    lines.push("## Information");
    lines.push("");
    lines.push(`**Persistence:** ${model.information.persistence}`);
    lines.push(`**Versioning:** ${model.information.versioning}`);
    lines.push(`**Access:** ${model.information.access}`);
    lines.push("");

    lines.push("## Time & Scale");
    lines.push("");
    lines.push(`**Cadence:** ${model.timeScale.cadence}`);
    lines.push(`**Lifecycle:** ${model.timeScale.lifecycle}`);
    lines.push(`**Volume:** ${model.timeScale.volume}`);
    lines.push("");

    if (model.exceptions.length > 0) {
      lines.push("## Exceptions");
      lines.push("");
      for (const exc of model.exceptions) {
        lines.push(`- ${exc}`);
      }
      lines.push("");
    }

    if (model.designImplications.length > 0) {
      lines.push("## Design Implications");
      lines.push("");
      for (const imp of model.designImplications) {
        lines.push(`- ${imp}`);
      }
      lines.push("");
    }

    if (completeness) {
      lines.push("---");
      lines.push("");
      lines.push("## Completeness Report");
      lines.push("");
      lines.push(`**Overall Coverage:** ${(completeness.overall * 100).toFixed(1)}%`);
      lines.push(`**Average Confidence:** ${(completeness.confidence * 100).toFixed(1)}%`);
      lines.push("");

      if (completeness.gaps.length > 0) {
        lines.push("### Gaps");
        lines.push("");
        for (const gap of completeness.gaps) {
          lines.push(`- ${gap}`);
        }
        lines.push("");
      }

      lines.push(`**Recommendation:** ${completeness.recommendation}`);
      lines.push("");
    }

    return lines.join("\n");
  }
}
