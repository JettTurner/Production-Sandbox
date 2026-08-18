import { DomainFact, Contradiction, KnowledgeSummary, SerializedKnowledgeState } from "../models/knowledge.js";
import { KnowledgeDomain } from "../models/enums.js";

function generateId(): string {
  return crypto.randomUUID();
}

export class KnowledgeStateManager {
  private facts: Map<string, DomainFact> = new Map();
  private contradictions: Contradiction[] = [];
  private readonly sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  addFact(fact: Omit<DomainFact, "id" | "timestamp">): DomainFact {
    const fullFact: DomainFact = {
      ...fact,
      id: generateId(),
      timestamp: Date.now(),
    };
    this.facts.set(fullFact.id, fullFact);
    return fullFact;
  }

  removeFact(id: string): boolean {
    return this.facts.delete(id);
  }

  removeFactsBySource(sourceId: string): DomainFact[] {
    const removed: DomainFact[] = [];
    for (const [id, fact] of this.facts) {
      if (fact.source === sourceId) {
        this.facts.delete(id);
        removed.push(fact);
      }
    }
    return removed;
  }

  getFactById(id: string): DomainFact | undefined {
    return this.facts.get(id);
  }

  getAllFacts(): DomainFact[] {
    return Array.from(this.facts.values());
  }

  getFactsByDomain(domain: KnowledgeDomain): DomainFact[] {
    return this.getAllFacts().filter(f => f.domain === domain);
  }

  getFactsByKey(key: string): DomainFact[] {
    return this.getAllFacts().filter(f => f.key === key);
  }

  hasFact(key: string, value?: unknown): boolean {
    if (value !== undefined) {
      return this.getAllFacts().some(f => f.key === key && f.value === value);
    }
    return this.getAllFacts().some(f => f.key === key);
  }

  getFactValue<T = unknown>(key: string): T | undefined {
    const fact = this.getAllFacts().find(f => f.key === key);
    return fact ? (fact.value as T) : undefined;
  }

  addContradiction(contradiction: Omit<Contradiction, "id">): Contradiction {
    const full: Contradiction = {
      ...contradiction,
      id: generateId(),
    };
    this.contradictions.push(full);
    return full;
  }

  resolveContradiction(contradictionId: string, resolution: string): void {
    const c = this.contradictions.find(x => x.id === contradictionId);
    if (c) {
      c.resolved = true;
      c.resolution = resolution;
    }
  }

  getContradictions(): Contradiction[] {
    return [...this.contradictions];
  }

  getUnresolvedContradictions(): Contradiction[] {
    return this.contradictions.filter(c => !c.resolved);
  }

  getCoverage(): Record<KnowledgeDomain, number> {
    const coverage: Record<KnowledgeDomain, number> = {} as Record<KnowledgeDomain, number>;
    const requiredKeys = this.getRequiredKeysPerDomain();

    for (const domain of Object.values(KnowledgeDomain)) {
      const domainFacts = this.getFactsByDomain(domain as KnowledgeDomain);
      const required = requiredKeys[domain as KnowledgeDomain] || 1;
      const uniqueKeys = new Set(
        domainFacts
          .filter(f => !f.key.startsWith("_answered_"))
          .map(f => f.key)
      );
      coverage[domain as KnowledgeDomain] = Math.min(1, uniqueKeys.size / required);
    }

    return coverage;
  }

  private getRequiredKeysPerDomain(): Record<KnowledgeDomain, number> {
    return {
      [KnowledgeDomain.Work]: 4,
      [KnowledgeDomain.People]: 3,
      [KnowledgeDomain.Relationships]: 3,
      [KnowledgeDomain.Flow]: 3,
      [KnowledgeDomain.Information]: 3,
      [KnowledgeDomain.TimeScale]: 2,
      [KnowledgeDomain.Exceptions]: 2,
    };
  }

  getAverageConfidence(): number {
    const facts = this.getAllFacts();
    if (facts.length === 0) return 0;
    return facts.reduce((sum, f) => sum + f.confidence, 0) / facts.length;
  }

  getSummary(): KnowledgeSummary {
    return {
      totalFacts: this.facts.size,
      coverageByDomain: this.getCoverage(),
      averageConfidence: this.getAverageConfidence(),
      unresolvedContradictions: this.getUnresolvedContradictions().length,
    };
  }

  serialize(): SerializedKnowledgeState {
    return {
      sessionId: this.sessionId,
      facts: this.getAllFacts(),
      contradictions: this.getContradictions(),
      summary: this.getSummary(),
    };
  }

  static deserialize(data: SerializedKnowledgeState): KnowledgeStateManager {
    const state = new KnowledgeStateManager(data.sessionId);
    for (const fact of data.facts) {
      state.facts.set(fact.id, fact);
    }
    state.contradictions = [...data.contradictions];
    return state;
  }
}
