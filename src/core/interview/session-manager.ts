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
  private questionHistory: { questionId: string; answer: Answer; factIds: string[]; followUpIds: string[] }[] = [];

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

    const factIds: string[] = [];

    const answeredFact = this.state.addFact({
      domain: question.domain,
      key: `_answered_${question.id}`,
      value: true,
      confidence: 1.0,
      importance: question.importance,
      source: question.id,
    });
    factIds.push(answeredFact.id);

    const facts = AnswerProcessor.toFacts(question, answer);
    for (const fact of facts) {
      const contradictions = this.detector.detect(this.state, fact);
      for (const c of contradictions) {
        this.state.addContradiction(c);
      }
      const added = this.state.addFact(fact);
      factIds.push(added.id);
    }

    const followUps = this.selector.getUnlockedFollowUps(question, answer.value);
    this.branchTracker.onQuestionAnswered(followUps);

    this.questionHistory.push({
      questionId: answer.questionId,
      answer,
      factIds,
      followUpIds: followUps,
    });

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

  goBack(): { question: Question; answer: Answer } | null {
    if (this.status !== SessionStatus.Active) return null;
    if (this.questionHistory.length === 0) return null;

    const last = this.questionHistory.pop()!;

    for (const factId of last.factIds) {
      this.state.removeFact(factId);
    }

    this.branchTracker.removeFollowUps(last.followUpIds);

    const question = getQuestionById(last.questionId);
    this.updatedAt = Date.now();

    return question ? { question, answer: last.answer } : null;
  }

  canGoBack(): boolean {
    return this.status === SessionStatus.Active && this.questionHistory.length > 0;
  }

  getQuestionHistory(): { questionId: string; answer: Answer }[] {
    return this.questionHistory.map(h => ({ questionId: h.questionId, answer: h.answer }));
  }

  getNextQuestion(): Question | null {
    const question = this.selector.selectNext(this.state, this.branchTracker);
    if (question && this.branchTracker.isQuestionOnFrontier(question.id)) {
      this.branchTracker.removeFromFrontier(question.id);
    }
    return question;
  }

  getResult(): InterviewResult {
    const nextQuestion = this.selector.selectNext(this.state, this.branchTracker);
    const effectiveStatus = (!nextQuestion && this.status === SessionStatus.Active)
      ? SessionStatus.Complete
      : this.status;

    return {
      nextQuestion,
      status: effectiveStatus,
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

  serialize(): SerializedSession {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      knowledgeState: this.state.serialize(),
      branchTracker: this.branchTracker.serialize(),
      questionHistory: this.questionHistory.map(h => ({
        questionId: h.questionId,
        answer: h.answer,
        factIds: h.factIds,
        followUpIds: h.followUpIds,
      })),
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
    if (data.questionHistory) {
      session.questionHistory = data.questionHistory.map(h => ({
        questionId: h.questionId,
        answer: h.answer,
        factIds: h.factIds,
        followUpIds: h.followUpIds,
      }));
    }
    return session;
  }
}
