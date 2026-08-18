import { KnowledgeDomain } from "./enums.js";

export interface DomainFact {
  id: string;
  domain: KnowledgeDomain;
  key: string;
  value: unknown;
  confidence: number;
  importance: number;
  source: string;
  timestamp: number;
}

export interface Contradiction {
  id: string;
  factA: string;
  factB: string;
  description: string;
  resolved: boolean;
  resolution?: string;
}

export interface KnowledgeSummary {
  totalFacts: number;
  coverageByDomain: Record<KnowledgeDomain, number>;
  averageConfidence: number;
  unresolvedContradictions: number;
}

export interface KnowledgeState {
  sessionId: string;
  facts: DomainFact[];
  contradictions: Contradiction[];
  summary: KnowledgeSummary;
}

export interface SerializedKnowledgeState {
  sessionId: string;
  facts: DomainFact[];
  contradictions: Contradiction[];
  summary: KnowledgeSummary;
}
