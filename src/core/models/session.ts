import { SessionStatus } from "./enums.js";
import { DomainFact, Contradiction, KnowledgeSummary } from "./knowledge.js";
import { BranchState } from "../question-engine/branch-tracker.js";
import { Answer } from "./questions.js";

export interface SerializedHistoryEntry {
  questionId: string;
  answer: Answer;
  factIds: string[];
  followUpIds: string[];
}

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
  questionHistory: SerializedHistoryEntry[];
  createdAt: number;
  updatedAt: number;
}
