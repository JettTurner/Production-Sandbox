import { SessionStatus } from "./enums.js";
import { DomainFact, Contradiction, KnowledgeSummary } from "./knowledge.js";

export interface SerializedSession {
  id: string;
  name: string;
  status: SessionStatus;
  knowledgeState: {
    sessionId: string;
    facts: DomainFact[];
    contradictions: Contradiction[];
    summary: KnowledgeSummary;
  };
  branchTracker: {
    stack: string[];
    explored: string[];
    unresolvedNodes: string[];
  };
  createdAt: number;
  updatedAt: number;
}
