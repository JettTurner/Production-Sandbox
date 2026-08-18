import { Question, QuestionOption } from "../models/questions.js";
import { KnowledgeStateManager } from "./knowledge-state.js";
import { BranchTracker } from "./branch-tracker.js";

interface ScoredQuestion {
  question: Question;
  score: number;
  reason: string;
}

export class QuestionSelector {
  private questions: Question[];

  constructor(questions: Question[]) {
    this.questions = questions;
  }

  selectNext(
    state: KnowledgeStateManager,
    branchTracker: BranchTracker
  ): Question | null {
    const answeredIds = this.getAnsweredQuestionIds(state);
    const candidates = this.questions.filter(q => {
      if (answeredIds.has(q.id)) return false;
      if (branchTracker.isQuestionExplored(q.id)) return false;
      if (!this.arePrerequisitesMet(q, state)) return false;
      return true;
    });

    if (candidates.length === 0) return null;

    const scored: ScoredQuestion[] = candidates.map(q => ({
      question: q,
      score: this.scoreQuestion(q, state, branchTracker),
      reason: this.getScoreReason(q, state, branchTracker),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].question;
  }

  private scoreQuestion(
    q: Question,
    state: KnowledgeStateManager,
    branchTracker: BranchTracker
  ): number {
    const unknownScore = this.unknownsScore(q, state);
    const importanceScore = q.importance;
    const confidenceScore = this.confidenceScore(q, state);
    const contradictionScore = this.contradictionScore(q, state);
    const unlockScore = this.unlockPotentialScore(q);

    return (
      unknownScore * 0.25 +
      importanceScore * 0.30 +
      confidenceScore * 0.15 +
      contradictionScore * 0.20 +
      unlockScore * 0.10
    );
  }

  private getScoreReason(
    q: Question,
    state: KnowledgeStateManager,
    branchTracker: BranchTracker
  ): string {
    const reasons: string[] = [];
    if (q.importance > 0.8) reasons.push("high importance");
    if (this.unknownsScore(q, state) > 0.7) reasons.push("addresses unknowns");
    if (this.contradictionScore(q, state) > 0.5) reasons.push("may resolve contradiction");
    if (this.unlockPotentialScore(q) > 0.5) reasons.push("unlocks follow-ups");
    return reasons.join(", ") || "general coverage";
  }

  private unknownsScore(q: Question, state: KnowledgeStateManager): number {
    if (q.tags.length === 0) return 0.5;
    const hasAny = q.tags.some(tag => state.hasFact(tag));
    return hasAny ? 0.2 : 0.8;
  }

  private confidenceScore(q: Question, state: KnowledgeStateManager): number {
    const avgConfidence = state.getAverageConfidence();
    return 1 - avgConfidence;
  }

  private contradictionScore(q: Question, state: KnowledgeStateManager): number {
    const unresolved = state.getUnresolvedContradictions();
    if (unresolved.length === 0) return 0;
    const relevant = unresolved.some(c => {
      const factA = state.getFactById(c.factA);
      const factB = state.getFactById(c.factB);
      return factA && factB &&
        (factA.domain === q.domain || factB.domain === q.domain);
    });
    return relevant ? 0.8 : 0.2;
  }

  private unlockPotentialScore(q: Question): number {
    if (!q.options || q.options.length === 0) return 0;
    const totalUnlocks = q.options.reduce((sum, o) => sum + o.unlocks.length, 0);
    return Math.min(1, totalUnlocks / 5);
  }

  private arePrerequisitesMet(q: Question, state: KnowledgeStateManager): boolean {
    return q.prerequisites.every(prereqId => state.hasFact(`_answered_${prereqId}`));
  }

  private getAnsweredQuestionIds(state: KnowledgeStateManager): Set<string> {
    const answered = new Set<string>();
    for (const fact of state.getAllFacts()) {
      if (fact.key.startsWith("_answered_")) {
        answered.add(fact.key.replace("_answered_", ""));
      }
    }
    return answered;
  }

  getUnlockedFollowUps(
    question: Question,
    answerValue: string
  ): string[] {
    if (!question.options) return [];
    const option = question.options.find(
      o => o.id === answerValue || o.value === answerValue
    );
    return option?.unlocks || [];
  }
}
