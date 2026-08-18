export interface BranchState {
  frontier: string[];
}

export class BranchTracker {
  private frontier: string[] = [];

  onQuestionAnswered(followUpIds: string[]): void {
    for (const id of [...followUpIds].reverse()) {
      this.frontier.unshift(id);
    }
  }

  removeFromFrontier(questionId: string): void {
    const idx = this.frontier.indexOf(questionId);
    if (idx !== -1) this.frontier.splice(idx, 1);
  }

  removeFollowUps(followUpIds: string[]): void {
    for (const id of followUpIds) {
      const idx = this.frontier.indexOf(id);
      if (idx !== -1) this.frontier.splice(idx, 1);
    }
  }

  hasFrontierItems(): boolean {
    return this.frontier.length > 0;
  }

  getFrontier(): string[] {
    return [...this.frontier];
  }

  isQuestionOnFrontier(questionId: string): boolean {
    return this.frontier.includes(questionId);
  }

  serialize(): BranchState {
    return { frontier: [...this.frontier] };
  }

  static deserialize(data: BranchState): BranchTracker {
    const tracker = new BranchTracker();
    tracker.frontier = [...data.frontier];
    return tracker;
  }
}
