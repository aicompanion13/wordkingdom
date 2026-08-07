import type { ObjectiveDefinition } from "./types";

export class ObjectiveManager {
  private progressValue = 0;

  constructor(readonly definition: ObjectiveDefinition) {}

  recordWord(): void {
    if (this.definition.kind === "WORDS") this.progressValue = Math.min(this.definition.target, this.progressValue + 1);
  }

  recordObstacles(count: number): void {
    if (this.definition.kind === "OBSTACLES") this.progressValue = Math.min(this.definition.target, this.progressValue + count);
  }

  progress(): { current: number; target: number; complete: boolean } {
    return { current: this.progressValue, target: this.definition.target, complete: this.progressValue >= this.definition.target };
  }
}
