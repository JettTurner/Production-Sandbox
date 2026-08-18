import { SessionStatus } from "./enums.js";
import { DomainFact, Contradiction, KnowledgeSummary } from "./knowledge.js";
import { BranchState } from "../question-engine/branch-tracker.js";

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
  branchTracker: BranchState;
  createdAt: number;
  updatedAt: number;
}
