# Directory Structure
```
Production-Sandbox/
├── src/
│   ├── core/                          # Pure logic, no UI dependencies
│   │   ├── models/
│   │   │   ├── knowledge.ts           # KnowledgeSchema types (Work, People, Relationships, Flow, Information, TimeScale, Exceptions)
│   │   │   ├── questions.ts           # Question, QuestionOption, DependencyChain types
│   │   │   ├── session.ts             # InterviewSession, Answer types
│   │   │   ├── production-model.ts    # ProductionModel output types
│   │   │   └── enums.ts               # Domain enums (WorkType, RelationshipType, etc.)
│   │   │
│   │   ├── question-engine/
│   │   │   ├── question-space.ts      # Loads/manages all question definitions
│   │   │   ├── knowledge-state.ts     # Tracks what we know + confidence + importance
│   │   │   ├── selector.ts            # The selection algorithm: "greatest reduction in important uncertainty"
│   │   │   ├── dependency-chains.ts   # Branching/follow-up logic
│   │   │   └── contradiction-detector.ts  # Cross-references answers for conflicts
│   │   │
│   │   ├── interview/
│   │   │   ├── session-manager.ts     # State machine: pending → active → paused → complete
│   │   │   ├── branch-tracker.ts      # DFS traversal: branch deeply, return to unresolved nodes
│   │   │   └── answer-processor.ts    # Updates knowledge state from raw answers
│   │   │
│   │   ├── production/
│   │   │   ├── model-builder.ts       # Converts KnowledgeState → ProductionModel
│   │   │   └── completeness.ts        # Coverage/confidence/uncertainty metrics
│   │   │
│   │   └── output/
│   │       ├── json-exporter.ts       # ProductionModel → JSON
│   │       └── markdown-report.ts     # ProductionModel → Markdown report
│   │
│   ├── data/                          # Question definitions (the "question bank")
│   │   ├── work.ts
│   │   ├── people.ts
│   │   ├── relationships.ts
│   │   ├── flow.ts
│   │   ├── information.ts
│   │   ├── time-scale.ts
│   │   └── exceptions.ts
│   │
│   ├── db/
│   │   ├── schema.ts                  # SQLite table definitions
│   │   ├── connection.ts              # Database connection manager
│   │   ├── repositories/
│   │   │   ├── session-repo.ts        # CRUD for interview sessions
│   │   │   ├── answer-repo.ts         # CRUD for answers
│   │   │   └── knowledge-repo.ts      # CRUD for knowledge state snapshots
│   │   └── migrations/
│   │       └── 001_initial.ts
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── sessions.ts            # POST /sessions, GET /sessions/:id, PATCH /sessions/:id
│   │   │   ├── questions.ts           # GET /sessions/:id/next-question
│   │   │   ├── answers.ts             # POST /sessions/:id/answers
│   │   │   └── export.ts              # GET /sessions/:id/export/:format
│   │   └── server.ts                  # Express/Hono server setup
│   │
│   └── ui/                            # Frontend (React, Preact, or vanilla)
│       ├── App.tsx
│       ├── pages/
│       │   ├── Home.tsx               # Session list
│       │   ├── Interview.tsx          # The active questioning interface
│       │   └── ProductionModel.tsx    # View the resulting model
│       ├── components/
│       │   ├── QuestionCard.tsx       # Renders a single question
│       │   ├── AnswerInput.tsx        # Text, select, multi-select, scale inputs
│       │   ├── CoverageBar.tsx        # Visual progress indicator
│       │   ├── ModelVisualization.tsx # Graph/tree view of the production model
│       │   └── ExportPanel.tsx        # JSON/Markdown download buttons
│       └── styles/
│
├── tests/
│   ├── unit/
│   │   ├── selector.test.ts
│   │   ├── knowledge-state.test.ts
│   │   ├── contradiction-detector.test.ts
│   │   └── model-builder.test.ts
│   └── integration/
│       ├── interview-flow.test.ts
│       └── export.test.ts
│
├── data/
│   └── questions/                     # Alternative: questions as JSON/YAML files
│       ├── work.json
│       ├── people.json
│       └── ...
│
├── prisma/ or migrations/             # DB schema
├── package.json
├── tsconfig.json
└── README.md
```

# Core Data Models

## src/core/models/enums.ts
```ts
export enum KnowledgeDomain {
  Work = "work",
  People = "people",
  Relationships = "relationships",
  Flow = "flow",
  Information = "information",
  TimeScale = "time_scale",
  Exceptions = "exceptions",
}

export enum QuestionType {
  Open = "open",           // Free text answer
  SingleChoice = "single", // Pick one from options
  MultiChoice = "multi",   // Pick multiple from options
  Scale = "scale",         // Numeric scale (1-5, etc.)
  Boolean = "boolean",     // Yes/no
}

export enum RelationshipType {
  Hierarchical = "hierarchical",
  Peer = "peer",
  CrossFunctional = "cross_functional",
  External = "external",
}

export enum FlowType {
  Sequential = "sequential",
  Parallel = "parallel",
  Iterative = "iterative",
  Hybrid = "hybrid",
}
```

## src/core/models/questions.ts
```ts
import { KnowledgeDomain, QuestionType } from "./enums";

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  /** Follow-up questions unlocked by selecting this option */
  unlocks: string[];
  /** Knowledge domains this answer touches */
  domains: KnowledgeDomain[];
}

export interface Question {
  id: string;
  domain: KnowledgeDomain;
  type: QuestionType;
  text: string;
  /** Ordered list of options (for choice types) */
  options?: QuestionOption[];
  /** Scale range (for scale type) */
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
  
  /** Which questions must be answered before this one is relevant */
  prerequisites: string[];
  /** Weight: how structurally important is this question (0-1) */
  importance: number;
  /** How many knowledge-state facts does answering this update? */
  knowledgeYield: number;
  /** Tags for grouping and dependency resolution */
  tags: string[];
}
```

## src/core/models/knowledge.ts
```ts
import { KnowledgeDomain, RelationshipType, FlowType } from "./enums";

export interface DomainFact {
  id: string;
  domain: KnowledgeDomain;
  key: string;
  value: unknown;
  confidence: number;     // 0-1, how certain is this fact
  importance: number;     // 0-1, how consequential to design
  source: string;         // question ID that produced this
  timestamp: number;
}

export interface KnowledgeState {
  sessionId: string;
  facts: DomainFact[];
  contradictions: Contradiction[];
  summary: KnowledgeSummary;
}

export interface Contradiction {
  id: string;
  factA: string;  // fact ID
  factB: string;  // fact ID
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
```

## src/core/models/production-model.ts
```ts
export interface ProductionModel {
  meta: {
    sessionId: string;
    generatedAt: string;
    coverage: number;
    confidence: number;
  };
  work: {
    primaryUnits: string[];
    types: string[];
    scale: string;
  };
  people: {
    roles: string[];
    responsibilities: string[];
    count: string;
  };
  relationships: {
    entities: string[];
    connections: { from: string; to: string; type: string }[];
  };
  flow: {
    pattern: string;
    handoffs: string[];
    boundaries: string[];
  };
  information: {
    persistence: string;
    versioning: string;
    access: string;
  };
  timeScale: {
    cadence: string;
    lifecycle: string;
    volume: string;
  };
  exceptions: string[];
  designImplications: string[];
}
```
# Question Engine Design
The heart of the system. Three key pieces:

## src/core/question-engine/knowledge-state.ts
```ts
export class KnowledgeState {
  private facts: Map<string, DomainFact> = new Map();
  private contradictions: Contradiction[] = [];

  addFact(fact: DomainFact): void {
    this.facts.set(fact.id, fact);
    this.checkForContradictions(fact);
  }

  /** Returns which domains have facts, and coverage % */
  getCoverage(): Record<KnowledgeDomain, number> {
    // Count facts per domain vs expected minimum
  }

  /** Returns average confidence across all facts */
  getConfidence(): number { ... }

  /** Returns facts with low confidence or high uncertainty */
  getUncertainAreas(): DomainFact[] { ... }

  /** Returns contradictions */
  getContradictions(): Contradiction[] { ... }

  /** Serialize for DB persistence */
  serialize(): SerializedState { ... }
  static deserialize(data: SerializedState): KnowledgeState { ... }
}
```

## src/core/question-engine/selector.ts
This is the "greatest reduction in important uncertainty" algorithm:

```ts
interface SelectionCriteria {
  unknowns: number;           // How many facts are missing in this domain
  importance: number;         // How consequential is this domain to design (0-1)
  confidence: number;         // How sure are we about existing facts (inverted: low confidence = high score)
  contradictions: number;     // How many contradictions exist in this area
  unlocksPotential: number;   // How many downstream questions would this unlock
}

export class QuestionSelector {
  private questionSpace: Question[];

  constructor(questions: Question[]) {
    this.questionSpace = questions;
  }

  selectNext(state: KnowledgeState): Question | null {
    const candidates = this.questionSpace.filter(q => 
      this.isPrerequisiteMet(q, state) && !this.isAlreadyAnswered(q, state)
    );

    if (candidates.length === 0) return null;

    // Score each candidate
    const scored = candidates.map(q => ({
      question: q,
      score: this.scoreQuestion(q, state),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    return scored[0].question;
  }

  private scoreQuestion(q: Question, state: KnowledgeState): number {
    const criteria = this.evaluateCriteria(q, state);
    
    // Weighted combination - the core formula
    return (
      criteria.unknowns * 0.25 +
      criteria.importance * 0.30 +
      criteria.confidence * 0.15 +
      criteria.contradictions * 0.20 +
      criteria.unlocksPotential * 0.10
    );
  }

  private isPrerequisiteMet(q: Question, state: KnowledgeState): boolean {
    return q.prerequisites.every(prereqId => 
      state.facts.has(prereqId)
    );
  }
}
```

## src/core/question-engine/branch-tracker.ts
This implements the DFS with backtracking described in section 7 of your paper:

```ts
export class BranchTracker {
  private stack: string[] = [];          // Question IDs we're currently exploring
  private explored: Set<string> = new Set();  // Questions we've already asked
  private unresolvedNodes: string[] = []; // Branch points with unexplored options

  /** Called when we answer a question that unlocks follow-ups */
  onBranchExplored(questionId: string, followUpIds: string[]): void {
    this.explored.add(questionId);
    // Add follow-ups to the front of the stack (depth-first)
    for (const id of followUpIds.reverse()) {
      if (!this.explored.has(id)) {
        this.stack.push(id);
      }
    }
  }

  /** Called when a question has no follow-ups - pop back to last branch point */
  onBranchComplete(): void {
    this.stack.pop();
    // If stack is empty but unresolvedNodes exist, restore from there
    if (this.stack.length === 0 && this.unresolvedNodes.length > 0) {
      this.stack.push(this.unresolvedNodes.pop()!);
    }
  }

  /** Record a branch point with unexplored options */
  registerBranchPoint(questionId: string, unexploredOptionIds: string[]): void {
    this.unexploredOptions.push(...unexploredOptionIds);
  }

  /** Is the interview done? No more questions to ask. */
  isComplete(): boolean {
    return this.stack.length === 0 && this.unresolvedNodes.length === 0;
  }
}
```

## src/core/question-engine/contradiction-detector.ts
```ts
export class ContradictionDetector {
  /** Rules that define what constitutes a contradiction */
  private rules: ContradictionRule[];

  detect(state: KnowledgeState, newFact: DomainFact): Contradiction[] {
    const contradictions: Contradiction[] = [];
    
    for (const rule of this.rules) {
      if (rule.check(state, newFact)) {
        contradictions.push({
          id: generateId(),
          factA: rule.existingFactId(state),
          factB: newFact.id,
          description: rule.describe(state, newFact),
          resolved: false,
        });
      }
    }
    
    return contradictions;
  }
}

// Example rule:
// If "each department owns its own work" AND "another department edits deliverables"
// → Contradiction: clarify responsibility transfer
```

# Interview Session Manager

## src/core/interview/session-manager.ts
```ts
export type SessionStatus = "pending" | "active" | "paused" | "complete" | "abandoned";

export class InterviewSession {
  private state: KnowledgeState;
  private branchTracker: BranchTracker;
  private selector: QuestionSelector;
  private detector: ContradictionDetector;
  private status: SessionStatus;

  constructor(sessionId: string, questions: Question[]) {
    this.state = new KnowledgeState(sessionId);
    this.branchTracker = new BranchTracker();
    this.selector = new QuestionSelector(questions);
    this.detector = new ContradictionDetector();
    this.status = "pending";
  }

  /** Get the next question to ask */
  getNextQuestion(): Question | null {
    if (this.status === "pending") this.status = "active";
    if (this.branchTracker.isComplete()) {
      this.status = "complete";
      return null;
    }
    return this.selector.selectNext(this.state);
  }

  /** Process an answer */
  processAnswer(questionId: string, answer: Answer): void {
    // 1. Convert raw answer to domain facts
    const facts = AnswerProcessor.toFacts(questionId, answer);

    // 2. Check for contradictions
    for (const fact of facts) {
      const contradictions = this.detector.detect(this.state, fact);
      this.state.contradictions.push(...contradictions);
    }

    // 3. Add facts to knowledge state
    facts.forEach(f => this.state.addFact(f));

    // 4. Update branch tracker
    const question = this.getQuestionById(questionId);
    const followUps = question.options
      ?.find(o => o.value === answer.value)
      ?.unlocks ?? [];
    this.branchTracker.onBranchExplored(questionId, followUps);

    // 5. Check if we should surface a contradiction to the user
    const unresolved = this.state.contradictions.filter(c => !c.resolved);
    if (unresolved.length > 0) {
      // Insert clarification question
    }
  }

  /** Generate the production model from accumulated knowledge */
  buildProductionModel(): ProductionModel {
    return ModelBuilder.build(this.state);
  }

  /** Export for persistence */
  serialize(): SerializedSession {
    return {
      id: this.state.sessionId,
      status: this.status,
      knowledgeState: this.state.serialize(),
      branchTracker: this.branchTracker.serialize(),
    };
  }
}
```

## src/core/interview/answer-processor.ts
```ts
export class AnswerProcessor {
  /** Maps a question + raw answer to domain facts */
  static toFacts(questionId: string, answer: Answer): DomainFact[] {
    const question = getQuestionById(questionId);
    
    switch (question.type) {
      case QuestionType.Boolean:
        return [{
          id: generateId(),
          domain: question.domain,
          key: question.tags[0],
          value: answer.value === "yes",
          confidence: 0.9,
          importance: question.importance,
          source: questionId,
          timestamp: Date.now(),
        }];

      case QuestionType.SingleChoice:
        const option = question.options!.find(o => o.id === answer.value);
        return option!.domains.map(domain => ({
          id: generateId(),
          domain,
          key: option!.label,
          value: option!.value,
          confidence: 0.85,
          importance: question.importance,
          source: questionId,
          timestamp: Date.now(),
        }));

      case QuestionType.MultiChoice:
        // Multiple facts, one per selection
        return answer.value.split(",").map(selectedId => { ... });

      case QuestionType.Scale:
        return [{
          domain: question.domain,
          key: question.tags[0],
          value: Number(answer.value),
          confidence: 0.7, // scales are subjective
          ...
        }];

      case QuestionType.Open:
        return [{
          domain: question.domain,
          key: "free_text",
          value: answer.text,
          confidence: 0.6, // free text needs interpretation
          ...
        }];
    }
  }
}
```

# Production Model Builder

## src/core/production/model-builder.ts
```ts
export class ModelBuilder {
  static build(state: KnowledgeState): ProductionModel {
    const facts = Array.from(state.facts.values());
    
    return {
      meta: {
        sessionId: state.sessionId,
        generatedAt: new Date().toISOString(),
        coverage: state.summary.coverageByDomain,
        confidence: state.summary.averageConfidence,
      },
      work: this.extractWork(facts),
      people: this.extractPeople(facts),
      relationships: this.extractRelationships(facts),
      flow: this.extractFlow(facts),
      information: this.extractInformation(facts),
      timeScale: this.extractTimeScale(facts),
      exceptions: this.extractExceptions(facts),
      designImplications: this.deriveImplications(facts),
    };
  }

  private static extractWork(facts: DomainFact[]): ProductionModel["work"] {
    const workFacts = facts.filter(f => f.domain === KnowledgeDomain.Work);
    return {
      primaryUnits: workFacts.filter(f => f.key === "primary_unit").map(f => f.value as string),
      types: workFacts.filter(f => f.key === "work_type").map(f => f.value as string),
      scale: workFacts.find(f => f.key === "scale")?.value as string ?? "unknown",
    };
  }

  private static deriveImplications(facts: DomainFact[]): string[] {
    // Rule-based derivation:
    // If "projects are persistent" AND "departments exchange work"
    //   → "File system should support cross-department sharing"
    // If "versions matter" AND "high volume"
    //   → "Version control is critical, not optional"
    const implications: string[] = [];
    
    // ... rule engine logic
    
    return implications;
  }
}
```

## src/core/production/completeness.ts
```ts
export class CompletenessAnalyzer {
  static analyze(state: KnowledgeState): CompletenessReport {
    const coverage = state.getCoverage();
    const confidence = state.getConfidence();
    const uncertainties = state.getUncertainAreas();
    const contradictions = state.getContradictions().filter(c => !c.resolved);

    return {
      overall: this.computeOverall(coverage, confidence),
      coverage,
      confidence,
      gaps: this.findGaps(coverage),
      uncertainties,
      contradictions,
      isReadyForDesign: confidence > 0.75 && contradictions.length === 0,
      recommendation: this.generateRecommendation(coverage, confidence, contradictions),
    };
  }
}
```

# Output Generators

## src/core/output/markdown-report.ts
```ts
export class MarkdownReportGenerator {
  static generate(model: ProductionModel): string {
    return [
      `# Production Model`,
      `> Generated: ${model.meta.generatedAt}`,
      `> Coverage: ${(model.meta.coverage * 100).toFixed(1)}% | Confidence: ${(model.meta.confidence * 100).toFixed(1)}%`,
      ``,
      `## Work`,
      ...this.list(model.work.primaryUnits),
      ``,
      `## People`,
      `**Roles:** ${model.people.roles.join(", ")}`,
      `**Responsibilities:** ${model.people.responsibilities.join(", ")}`,
      ``,
      `## Relationships`,
      ...model.relationships.connections.map(c => `- ${c.from} → ${c.to} (${c.type})`),
      ``,
      `## Flow`,
      `**Pattern:** ${model.flow.pattern}`,
      `**Handoffs:** ${model.flow.handoffs.join("; ")}`,
      ``,
      `## Information`,
      `**Persistence:** ${model.information.persistence}`,
      `**Versioning:** ${model.information.versioning}`,
      `**Access:** ${model.information.access}`,
      ``,
      `## Exceptions`,
      ...model.exceptions.map(e => `- ${e}`),
      ``,
      `## Design Implications`,
      ...model.designImplications.map(d => `- ${d}`),
    ].join("\n");
  }
}
```

# SQLite Schema

## src/db/schema.ts
```ts
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE answers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  question_id TEXT NOT NULL,
  answer_value TEXT NOT NULL,
  answered_at INTEGER NOT NULL
);

CREATE TABLE knowledge_facts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  domain TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL NOT NULL,
  importance REAL NOT NULL,
  source_question TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE contradictions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  fact_a TEXT NOT NULL REFERENCES knowledge_facts(id),
  fact_b TEXT NOT NULL REFERENCES knowledge_facts(id),
  description TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolution TEXT
);

CREATE TABLE knowledge_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  state_json TEXT NOT NULL,
  snapshot_at INTEGER NOT NULL
);
```

# Web UI (API Routes + Frontend)

## API Routes
```
POST   /api/sessions                    → Create new session
GET    /api/sessions                    → List all sessions
GET    /api/sessions/:id                → Get session details
PATCH  /api/sessions/:id                → Update session status
DELETE /api/sessions/:id                → Delete session

GET    /api/sessions/:id/next-question  → Get next question for session
POST   /api/sessions/:id/answers        → Submit answer
GET    /api/sessions/:id/completeness   → Get coverage/confidence report

POST   /api/sessions/:id/export/json    → Export production model as JSON
POST   /api/sessions/:id/export/markdown → Export production model as Markdown
```

## UI Flow
```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Home Page     │────▶│   Interview      │────▶│  Production     │
│   Session List  │     │   (Questioning)  │     │  Model Viewer    │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                              │                         │
                         Coverage Bar              Export Panel
                         Contradiction Alerts      Model Graph
                         Pause/Resume              Markdown Report
```
## Key Algorithm: Question Selection
The scoring formula from selector.ts is the intellectual core:
```
score(q) = 
    w1 * unknowns(q)        // how many missing facts this addresses
  + w2 * importance(q)      // how structurally important (from question def)
  + w3 * (1 - confidence(q))// low confidence areas need more questions
  + w4 * contradictions(q)  // areas with contradictions need clarification
  + w5 * unlocksPotential(q)// how many follow-up questions this enables
```
Default weights: w1=0.25, w2=0.30, w3=0.15, w4=0.20, w5=0.10

The system always asks the question that provides the greatest reduction in important uncertainty.
---

## Summary: Implementation Layers

```
┌──────────────────────────────────────────────────────────────┐
│                    WEB UI (React/HTML)                       │
│  Interview screen │ Model viewer │ Export panel              │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTP
┌───────────────────────────┴──────────────────────────────────┐
│                    API LAYER (Express/Hono)                  │
│  /sessions  /questions  /answers  /export                    │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────┴──────────────────────────────────┐
│                    CORE ENGINE (Pure TS)                     │
│                                                              │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Question     │  │  Knowledge   │  │  Production      │   │
│  │  Selector     │  │  State       │  │  Model Builder   │   │
│  │               │  │              │  │                  │   │
│  │  scoring      │  │  facts       │  │  facts → model   │   │
│  │  algorithm    │  │  confidence  │  │  implications    │   │
│  └──────┬────────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                  │                   │             │
│  ┌──────┴────────┐  ┌──────┴───────┐  ┌────────┴─────────┐   │
│  │  Branch       │  │  Contradict. │  │  Output          │   │
│  │  Tracker      │  │  Detector    │  │  Generators      │   │
│  │  (DFS)        │  │              │  │  JSON + MD       │   │
│  └───────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
│  Question Definitions (data/*.ts)                            │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────┴─────────────────────────────────┐
│                    DATA LAYER                                │
│  SQLite: sessions │ answers │ facts │ contradictions         │
└──────────────────────────────────────────────────────────────┘
```

## Suggested Build Order

1. **Data models** (`enums.ts`, `questions.ts`, `knowledge.ts`, `production-model.ts`) - the type system
2. **Question definitions** (`data/work.ts`, `data/people.ts`, etc.) - the question bank
3. **Knowledge state** (`knowledge-state.ts`) - fact tracking
4. **Selector** (`selector.ts`) - the scoring algorithm
5. **Answer processor** (`answer-processor.ts`) - raw answer → domain facts
6. **Branch tracker** (`branch-tracker.ts`) - DFS traversal
7. **Session manager** (`session-manager.ts`) - orchestrates the above
8. **Contradiction detector** (`contradiction-detector.ts`) - cross-referencing
9. **Model builder** (`model-builder.ts`) - knowledge → production model
10. **Output generators** (`json-exporter.ts`, `markdown-report.ts`)
11. **Database layer** (`schema.ts`, repositories)
12. **API routes**
13. **Web UI**
