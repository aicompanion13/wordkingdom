"use client";

import styles from "./ObjectiveTray.module.css";
import { buildObjectiveTray, objectiveTileLabel } from "@/game/v3/objective-tray-state";
import type { ObjectiveTrayInput } from "@/game/v3/objective-tray-state";

export function ObjectiveTray({
  activeWords,
  recommendedObjectiveId,
  hintedTileId,
  stall,
}: ObjectiveTrayInput & { stall?: string }) {
  const tiles = buildObjectiveTray({ activeWords, recommendedObjectiveId, hintedTileId });
  if (!tiles.length) return null;
  return <section className={styles.tray} data-ftue-stall={stall}>
    <ul className={styles.rail} data-count={tiles.length} aria-label="Objectives">
      {tiles.map((tile) => <li
        className={styles.objective}
        data-state={tile.state}
        data-ftue-active-word="true"
        aria-label={objectiveTileLabel(tile)}
        key={tile.id}
      >
        <span>{tile.word}</span>
      </li>)}
    </ul>
  </section>;
}
