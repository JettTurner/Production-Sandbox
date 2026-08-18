import { Question, Answer } from "../models/questions.js";
import { SessionStatus } from "../models/enums.js";
import { SerializedSession } from "../models/session.js";
import { KnowledgeStateManager } from "../question-engine/knowledge-state.js";
import { QuestionSelector } from "../question-engine/selector.js";
import { BranchTracker } from "../question-engine/branch-tracker.js";
import { ContradictionDetector } from "../question-engine/contradiction-detector.js";
import { AnswerProcessor } from "../question-engine/answer-processor.js";
import { allQuestions, getQuestionById } from "../../data/index.js";

function generateId(): string {
  return crypto.randomUUID();
}

export interface InterviewResult {
  nextQuestion: Question | null;
  status: SessionStatus;
  contradictions: { description: string; resolved: boolean }[];
  completeness: {
    totalFacts: number;
    averageConfidence: number;
    coverage: Record<string, number>;
  };
}

export class InterviewSession {
  readonly id: string;
  name: string;
  private state: KnowledgeStateManager;
  private branchTracker: BranchTracker;
  private selector: QuestionSelector;
  private detector: ContradictionDetector;
  private status: SessionStatus;
  private createdAt: number;
  private updatedAt: number;
  private questionHistory: { questionId: string; answer: Answer }[] = [];

  constructor(name?: string, sessionId?: string) {
    this.id = sessionId || generateId();
    this.name = name || `Interview ${new Date().toISOString().split("T")[0]}`;
    this.state = new KnowledgeStateManager(this.id);
    this.branchTracker = new BranchTracker();
    this.selector = new QuestionSelector(allQuestions);
    this.detector = new ContradictionDetector();
    this.status = SessionStatus.Pending;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  start(): InterviewResult {
    this.status = SessionStatus.Active;
    this.updatedAt = Date.now();
    return this.getResult();
  }

  processAnswer(answer: Answer): InterviewResult {
    if (this.status !== SessionStatus.Active) {
      throw new Error(`Cannot answer in status: ${this.status}`);
    }

    const question = getQuestionById(answer.questionId);
    if (!question) throw new Error(`Question not found: ${answer.questionId}`);

    this.questionHistory.push({ questionId: answer.questionId, answer });

    // Record that this question was answered
    this.state.addFact({
      domain: question.domain,
      key: `_answered_${question.id}`,
      value: true,
      confidence: 1.0,
      importance: question.importance,
      source: question.id,
    });

    // Process answer into domain facts
    const facts = AnswerProcessor.toFacts(question, answer);
    for (const fact of facts) {
      // Check for contradictions before adding
      const contradictions = this.detector.detect(this.state, fact);
      for (const c of contradictions) {
        this.state.addContradiction(c);
      }
      this.state.addFact(fact);
    }

    // Update branch tracker
    const followUps = this.selector.getUnlockedFollowUps(question, answer.value);
    this.branchTracker.onBranchExplored(question.id, followUps);

    // If no follow-ups, complete this branch
    if (followUps.length === 0) {
      this.branchTracker.onBranchComplete();
    }

    this.updatedAt = Date.now();
    return this.getResult();
  }

  pause(): void {
    if (this.status === SessionStatus.Active) {
      this.status = SessionStatus.Paused;
      this.updatedAt = Date.now();
    }
  }

  resume(): InterviewResult {
    if (this.status === SessionStatus.Paused) {
      this.status = SessionStatus.Active;
      this.updatedAt = Date.now();
    }
    return this.getResult();
  }

  complete(): void {
    this.status = SessionStatus.Complete;
    this.updatedAt = Date.now();
  }

  getNextQuestion(): Question | null {
    if (this.branchTracker.isComplete()) {
      this.status = SessionStatus.Complete;
      return null;
    }
    return this.selector.selectNext(this.state, this.branchTracker);
  }

  getResult(): InterviewResult {
    const nextQuestion = this.getNextQuestion();
    if (!nextQuestion && this.status === SessionStatus.Active) {
      this.status = SessionStatus.Complete;
    }

    return {
      nextQuestion,
      status: this.status,
      contradictions: this.state.getContradictions().map(c => ({
        description: c.description,
        resolved: c.resolved,
      })),
      completeness: {
        totalFacts: this.state.getSummary().totalFacts,
        averageConfidence: this.state.getSummary().averageConfidence,
        coverage: this.state.getSummary().coverageByDomain,
      },
    };
  }

  getState(): KnowledgeStateManager {
    return this.state;
  }

  getBranchTracker(): BranchTracker {
    return this.branchTracker;
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  getCreatedAt(): number {
    return this.createdAt;
  }

  getUpdatedAt(): number {
    return this.updatedAt;
  }

  getQuestionHistory(): { questionId: string; answer: Answer }[] {
    return [...this.questionHistory];
  }

  serialize(): SerializedSession {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      knowledgeState: this.state.serialize(),
      branchTracker: this.branchTracker.serialize(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static deserialize(data: SerializedSession): InterviewSession {
    const session = new InterviewSession(data.name, data.id);
    session.status = data.status;
    session.createdAt = data.createdAt;
    session.updatedAt = data.updatedAt;
    session.state = KnowledgeStateManager.deserialize(data.knowledgeState);
    session.branchTracker = BranchTracker.deserialize(data.branchTracker);
    return session;
  }
}
