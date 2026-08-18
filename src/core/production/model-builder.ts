import { ProductionModel } from "../models/production-model.js";
import { KnowledgeStateManager } from "../question-engine/knowledge-state.js";
import { DomainFact } from "../models/knowledge.js";

export class ModelBuilder {
  static build(sessionId: string, state: KnowledgeStateManager): ProductionModel {
    const facts = state.getAllFacts();
    const summary = state.getSummary();
    const totalCoverage = Object.values(summary.coverageByDomain).reduce((a, b) => a + b, 0) / 7;

    return {
      meta: {
        sessionId,
        generatedAt: new Date().toISOString(),
        coverage: totalCoverage,
        confidence: summary.averageConfidence,
      },
      work: ModelBuilder.extractWork(facts),
      people: ModelBuilder.extractPeople(facts),
      relationships: ModelBuilder.extractRelationships(facts),
      flow: ModelBuilder.extractFlow(facts),
      information: ModelBuilder.extractInformation(facts),
      timeScale: ModelBuilder.extractTimeScale(facts),
      exceptions: ModelBuilder.extractExceptions(facts),
      designImplications: ModelBuilder.deriveImplications(facts),
    };
  }

  private static extractWork(facts: DomainFact[]): ProductionModel["work"] {
    const type = facts.find(f => f.key === "work_type")?.value as string || "unknown";
    const unit = facts.find(f => f.key === "primary_unit")?.value as string || "unknown";
    const scale = facts.find(f => f.key === "scale_level")?.value as string || "unknown";
    const deliverable = facts.find(f => f.key === "deliverable")?.value as string || "";
    const iterations = facts.find(f => f.key === "iterations")?.value;
    const iterationsCount = facts.find(f => f.key === "iterations_count")?.value;

    return {
      primaryUnits: unit !== "unknown" ? [unit] : [],
      types: type !== "unknown" ? [type] : [],
      scale,
    };
  }

  private static extractPeople(facts: DomainFact[]): ProductionModel["people"] {
    const count = facts.find(f => f.key === "count")?.value as string || "unknown";
    const roles = facts
      .filter(f => f.key.startsWith("roles_") && f.value === true)
      .map(f => f.key.replace("roles_", ""));
    const departments = facts.find(f => f.key === "departments")?.value;
    const management = facts.find(f => f.key === "management")?.value as string;
    const clientInteraction = facts.find(f => f.key === "clients")?.value;

    return {
      roles,
      responsibilities: management ? [management] : [],
      count,
    };
  }

  private static extractRelationships(facts: DomainFact[]): ProductionModel["relationships"] {
    const hierarchy = facts.find(f => f.key === "hierarchy")?.value as string || "unknown";
    const independence = facts.find(f => f.key === "rel_department_independence")?.value as string;
    const collaboration = facts
      .filter(f => f.key.startsWith("collaboration_") && f.value === true)
      .map(f => f.key.replace("collaboration_", ""));

    const entities: string[] = [];
    const connections: { from: string; to: string; type: string }[] = [];

    if (hierarchy !== "unknown") {
      entities.push("Organization");
      if (hierarchy === "hierarchical") {
        connections.push({ from: "Organization", to: "Departments", type: "hierarchical" });
      } else if (hierarchy === "matrix") {
        connections.push({ from: "Organization", to: "Departments", type: "matrix" });
      }
    }

    if (independence === "tightly_integrated") {
      entities.push("Cross-functional Teams");
      connections.push({ from: "Departments", to: "Cross-functional Teams", type: "cross_functional" });
    }

    return { entities, connections };
  }

  private static extractFlow(facts: DomainFact[]): ProductionModel["flow"] {
    const pattern = facts.find(f => f.key === "pattern")?.value as string || "unknown";
    const stages = facts.find(f => f.key === "stages")?.value as string || "";
    const handoffs = facts
      .filter(f => f.key.startsWith("handoffs_") && f.value === true)
      .map(f => f.key.replace("handoffs_", ""));
    const bottlenecks = facts.find(f => f.key === "bottlenecks")?.value;
    const approval = facts.find(f => f.key === "approval")?.value;

    return {
      pattern,
      handoffs,
      boundaries: bottlenecks ? ["bottleneck"] : [],
    };
  }

  private static extractInformation(facts: DomainFact[]): ProductionModel["information"] {
    const persistence = facts.find(f => f.key === "persistence")?.value as string || "unknown";
    const versioning = facts.find(f => f.key === "versioning")?.value as string || "unknown";
    const access = facts.find(f => f.key === "access")?.value as string || "unknown";
    const fileManagement = facts.find(f => f.key === "storage")?.value as string;
    const folderDepth = facts.find(f => f.key === "depth")?.value;

    return {
      persistence,
      versioning,
      access,
    };
  }

  private static extractTimeScale(facts: DomainFact[]): ProductionModel["timeScale"] {
    const cadence = facts.find(f => f.key === "cadence")?.value as string || "unknown";
    const volume = facts.find(f => f.key === "volume_level")?.value as string || "unknown";
    const scale = facts.find(f => f.key === "scale")?.value as string;

    return {
      cadence,
      lifecycle: cadence,
      volume,
    };
  }

  private static extractExceptions(facts: DomainFact[]): string[] {
    const exceptions: string[] = [];
    const exceptionKeys = [
      "restart", "scope_change", "approval_delay",
      "rework", "emergency", "pause",
    ];

    for (const key of exceptionKeys) {
      const fact = facts.find(f => f.key === `exceptions_${key}` || f.key === key);
      if (fact && fact.value === true) {
        exceptions.push(key.replace(/_/g, " "));
      }
    }

    const customException = facts.find(f => f.key === "exceptions");
    if (customException && typeof customException.value === "string") {
      exceptions.push(customException.value);
    }

    return exceptions;
  }

  private static deriveImplications(facts: DomainFact[]): string[] {
    const implications: string[] = [];

    const unit = facts.find(f => f.key === "primary_unit")?.value;
    const independence = facts.find(f => f.key === "rel_department_independence")?.value;
    const versioning = facts.find(f => f.key === "versioning")?.value;
    const persistence = facts.find(f => f.key === "persistence")?.value;
    const handoffs = facts.filter(f => f.key.startsWith("handoffs_") && f.value === true);
    const access = facts.find(f => f.key === "access")?.value;
    const iterations = facts.find(f => f.key === "iterations")?.value;

    if (unit === "projects") {
      implications.push("File system or database should organize around projects as primary entities.");
    }

    if (independence === "tightly_integrated") {
      implications.push("Cross-department sharing mechanisms are critical. Consider shared workspaces or collaboration tools.");
    }

    if (versioning === "file_naming" || versioning === "manual") {
      implications.push("Version control is informal. A structured versioning system could reduce confusion.");
    } else if (versioning === "version_control") {
      implications.push("Version control is already in place. Design should integrate with existing system.");
    }

    if (persistence === "indefinite" || persistence === "long_term") {
      implications.push("Information must be retained long-term. Archive structure and retention policies are needed.");
    }

    if (handoffs.length > 2) {
      implications.push("Frequent handoffs suggest need for clear handoff documentation and tracking.");
    }

    if (access === "sensitive") {
      implications.push("Sensitive information requires strict access controls and audit trails.");
    }

    if (iterations === true) {
      implications.push("Iterative work suggests need for revision tracking and draft/final states.");
    }

    const exceptions = facts.filter(f => f.key.startsWith("exceptions_") && f.value === true);
    if (exceptions.length > 2) {
      implications.push("Many exceptions suggest the formal process may be too rigid. Consider flexible workflow states.");
    }

    if (implications.length === 0) {
      implications.push("Insufficient data to derive specific design implications. Complete more of the interview.");
    }

    return implications;
  }
}
