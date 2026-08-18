import { Question } from "../models/questions.js";
import { KnowledgeStateManager } from "./knowledge-state.js";

export interface BranchState {
  stack: string[];
  explored: string[];
  unresolvedNodes: string[];
}

export class BranchTracker {
  private stack: string[] = [];
  private explored: Set<string> = new Set();
  private unresolvedNodes: string[] = [];

  onBranchExplored(questionId: string, followUpIds: string[]): void {
    this.explored.add(questionId);
    const newFollowUps = followUpIds.filter(id => !this.explored.has(id));
    for (let i = newFollowUps.length - 1; i >= 0; i--) {
      this.stack.push(newFollowUps[i]);
    }
  }

  onBranchComplete(): void {
    if (this.stack.length > 0) {
      this.stack.pop();
    }
  }

  registerBranchPoint(questionId: string, unexploredOptionIds: string[]): void {
    const fresh = unexploredOptionIds.filter(id => !this.explored.has(id));
    this.unresolvedNodes.push(...fresh);
  }

  getNextFromStack(): string | undefined {
    return this.stack[this.stack.length - 1];
  }

  popFromStack(): string | undefined {
    return this.stack.pop();
  }

  isQuestionExplored(questionId: string): boolean {
    return this.explored.has(questionId);
  }

  isComplete(): boolean {
    return this.stack.length === 0 && this.unresolvedNodes.length === 0;
  }

  getDepth(): number {
    return this.stack.length;
  }

  serialize(): BranchState {
    return {
      stack: [...this.stack],
      explored: Array.from(this.explored),
      unresolvedNodes: [...this.unresolvedNodes],
    };
  }

  static deserialize(data: BranchState): BranchTracker {
    const tracker = new BranchTracker();
    tracker.stack = [...data.stack];
    tracker.explored = new Set(data.explored);
    tracker.unresolvedNodes = [...data.unresolvedNodes];
    return tracker;
  }
}
