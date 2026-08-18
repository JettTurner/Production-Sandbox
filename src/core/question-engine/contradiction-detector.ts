import { DomainFact, Contradiction } from "../models/knowledge.js";
import { KnowledgeStateManager } from "./knowledge-state.js";
import { KnowledgeDomain } from "../models/enums.js";

function generateId(): string {
  return crypto.randomUUID();
}

interface ContradictionRule {
  id: string;
  name: string;
  check: (state: KnowledgeStateManager, newFact: DomainFact) => boolean;
  describe: (state: KnowledgeStateManager, newFact: DomainFact) => string;
  getExistingFactId: (state: KnowledgeStateManager, newFact: DomainFact) => string | null;
}

const rules: ContradictionRule[] = [
  {
    id: "dept_ownership_vs_cross_edit",
    name: "Department ownership vs cross-department editing",
    check: (state, newFact) => {
      if (newFact.key !== "shared_work_true" && newFact.key !== "tightly_integrated_selected") return false;
      const ownershipFact = state.getAllFacts().find(
        f => f.key === "very_independent_selected" || f.key === "rel_department_independence"
      );
      return ownershipFact?.value === "very_independent";
    },
    describe: () =>
      "Departments are described as independent, but work is shared across them. Clarify: when work crosses boundaries, does responsibility transfer, stay with the originator, or depend on the project?",
    getExistingFactId: (state) => {
      const fact = state.getAllFacts().find(
        f => f.key === "very_independent_selected" || f.key === "rel_department_independence"
      );
      return fact?.id ?? null;
    },
  },
  {
    id: "no_departments_vs_handoffs",
    name: "No departments but handoffs exist",
    check: (state, newFact) => {
      if (newFact.key !== "team_to_team" && newFact.key !== "handoffs_true") return false;
      const hasDept = state.hasFact("people_has_departments", false);
      return hasDept;
    },
    describe: () =>
      "Handoffs between teams are described, but the organization claims to have no departments. Clarify how work passes between different groups of people.",
    getExistingFactId: (state) => {
      const fact = state.getAllFacts().find(f => f.key === "people_has_departments");
      return fact?.id ?? null;
    },
  },
  {
    id: "low_volume_vs_many_deliverables",
    name: "Low scale vs high volume",
    check: (state, newFact) => {
      if (newFact.key !== "ts_weekly_volume") return false;
      const scaleFact = state.getAllFacts().find(f => f.key === "scale_level");
      if (!scaleFact) return false;
      return scaleFact.value === "low" && Number(newFact.value) > 3;
    },
    describe: () =>
      "The organization describes itself as low scale, but reports high weekly volume. Clarify the actual volume of active work.",
    getExistingFactId: (state) => {
      const fact = state.getAllFacts().find(f => f.key === "scale_level");
      return fact?.id ?? null;
    },
  },
];

export class ContradictionDetector {
  detect(state: KnowledgeStateManager, newFact: DomainFact): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (const rule of rules) {
      if (rule.check(state, newFact)) {
        const existingFactId = rule.getExistingFactId(state, newFact);
        if (existingFactId) {
          contradictions.push({
            id: generateId(),
            factA: existingFactId,
            factB: newFact.id,
            description: rule.describe(state, newFact),
            resolved: false,
          });
        }
      }
    }

    return contradictions;
  }
}
