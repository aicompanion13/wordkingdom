"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ObjectiveTray.module.css";
import { nextObjectiveTrayWakeMs, objectiveTileLabel, reconcileObjectiveTray } from "@/game/v3/objective-tray-state";
import type { ObjectiveTile, ObjectiveTrayInput } from "@/game/v3/objective-tray-state";

export function ObjectiveTray({
  activeWords,
  recommendedObjectiveId,
  hintedTileId,
  stall,
}: ObjectiveTrayInput & { stall?: string }) {
  const [tiles, setTiles] = useState<ObjectiveTile[]>([]);
  /*
   * The tray remembers what it was showing so a found word can stay gold in its own
   * slot. Reconciling off a ref keeps the effect from depending on its own output.
   */
  const shown = useRef<ObjectiveTile[]>([]);

  useEffect(() => {
    const input = { activeWords, recommendedObjectiveId, hintedTileId };
    let timer: number | undefined;

    const apply = () => {
      const next = reconcileObjectiveTray(shown.current, input);
      shown.current = next;
      setTiles(next);
      // A word waiting on a held gold slot needs one more pass once the hold expires.
      const wake = nextObjectiveTrayWakeMs(next, input);
      if (wake !== null) timer = window.setTimeout(apply, wake + 20);
    };

    apply();
    return () => window.clearTimeout(timer);
  }, [activeWords, recommendedObjectiveId, hintedTileId]);

  if (!tiles.length) return null;
  return <section className={styles.tray} data-ftue-stall={stall}>
    <ul className={styles.rail} data-count={tiles.length} aria-label="Objectives">
      {tiles.map((tile) => <li
        className={styles.objective}
        data-state={tile.state}
        data-ftue-active-word={tile.state === "completed" ? undefined : "true"}
        aria-label={objectiveTileLabel(tile)}
        key={tile.id}
      >
        <span>{tile.word}</span>
      </li>)}
    </ul>
  </section>;
}
