"use client";

import styles from "./LevelCompletePanel.module.css";
import { formatRewardAmount, levelRewardLabel, levelRewardSlots } from "@/game/v3/level-complete-rewards";
import type { LevelRewardInput, LevelRewardSlot } from "@/game/v3/level-complete-rewards";

/*
 * The hint icon is a placeholder. Codex's reward sheet currently ships a lightning bolt
 * for this slot, but the reward is hints, so the glyph the game already uses for hints
 * stands in until the drawn lightbulb arrives. Swapping it is one line.
 */
const REWARD_ART: Record<LevelRewardSlot["kind"], { src?: string; glyph?: string; alt: string }> = {
  coins: { src: "/level-complete/reward-coin.webp", alt: "Coins" },
  hints: { glyph: "💡", alt: "Hints" },
  card: { src: "/level-complete/reward-card.webp", alt: "Royal card" },
};

export function LevelCompletePanel({
  stars,
  score,
  timeLabel,
  accuracyLabel,
  longestWord,
  hintsUsed,
  rewards,
  cta,
  onContinue,
  levelLabel,
}: {
  stars: number;
  score: string;
  timeLabel: string;
  accuracyLabel: string;
  longestWord: string;
  hintsUsed: number;
  rewards: LevelRewardInput;
  cta: string;
  onContinue: () => void;
  levelLabel: string;
}) {
  const slots = levelRewardSlots(rewards);
  const earnedStars = Math.max(0, Math.min(3, stars));

  return <div className={styles.overlay}>
    <section
      className={styles.panel}
      role="dialog"
      aria-modal="true"
      aria-label={`${levelLabel} complete, ${earnedStars} of 3 stars`}
    >
      <img className={styles.art} src="/level-complete/panel.webp" alt="" />

      {[0, 1, 2].filter((slot) => slot < earnedStars).map((slot) => (
        <img className={styles.star} data-slot={slot} key={slot} src="/level-complete/star-gold.webp" alt="" />
      ))}

      <span className={`${styles.value} ${styles.score}`}>{score}</span>
      <span className={`${styles.value} ${styles.time}`}>{timeLabel}</span>
      <span className={`${styles.value} ${styles.accuracy}`}>{accuracyLabel}</span>
      <span className={`${styles.value} ${styles.longest}`}>{longestWord || "—"}</span>
      <span className={`${styles.value} ${styles.hints}`}>{hintsUsed}</span>

      <ul className={styles.rewards} aria-label="Level reward">
        {slots.map((slot) => {
          const art = REWARD_ART[slot.kind];
          return <li className={styles.reward} data-earned={slot.earned} key={slot.kind} aria-label={levelRewardLabel(slot)}>
            {art.src
              ? <img src={art.src} alt="" aria-hidden="true" />
              : <span aria-hidden="true" style={{ fontSize: "clamp(20px,6vw,28px)", lineHeight: 1 }}>{art.glyph}</span>}
            <b>{formatRewardAmount(slot)}</b>
          </li>;
        })}
      </ul>

      <button className={styles.cta} type="button" onClick={onContinue}>{cta}</button>
    </section>
  </div>;
}
