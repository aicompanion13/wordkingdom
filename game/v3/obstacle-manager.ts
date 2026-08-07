import type { ActiveWord, AreaObstacleDefinition } from "../v2/types";
import type { ObstacleState } from "./types";

export class ObstacleManager {
  private tileIds = new Set<string>();
  private cleared = 0;

  constructor(private readonly definition: AreaObstacleDefinition, private readonly target: number) {}

  seed(activeWords: ActiveWord[]): ObstacleState {
    this.tileIds.clear();
    const remaining = Math.max(0, this.target - this.cleared);
    activeWords.forEach((word) => word.tileIds.slice(0, Math.min(2, remaining)).forEach((id) => this.tileIds.add(id)));
    return this.snapshot();
  }

  clear(tileIds: string[]): number {
    let count = 0;
    tileIds.forEach((id) => {
      if (this.tileIds.delete(id)) count += 1;
    });
    this.cleared = Math.min(this.target, this.cleared + count);
    return count;
  }

  snapshot(): ObstacleState {
    return { key: this.definition.key, icon: this.definition.icon, tileIds: [...this.tileIds], cleared: this.cleared, target: this.target };
  }
}
