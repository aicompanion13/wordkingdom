"use client";

import { useEffect, useRef } from "react";
import styles from "./LevelCompletePanel.module.css";
import { formatRewardAmount, levelRewardLabel, levelRewardSlots } from "@/game/v3/level-complete-rewards";
import type { LevelRewardInput, LevelRewardSlot } from "@/game/v3/level-complete-rewards";

const REWARD_ART: Record<LevelRewardSlot["kind"], { src: string; alt: string }> = {
  coins: { src: "/level-complete/reward-coin.webp", alt: "Coins" },
  hints: { src: "/level-complete/reward-hint.webp", alt: "Hints" },
  card: { src: "/level-complete/reward-card.webp", alt: "Royal card" },
};

export function LevelCompletePanel({
  title,
  stars,
  score,
  timeLabel,
  accuracyLabel,
  longestWord,
  hintsUsed,
  rewards,
  onContinue,
}: {
  title: string;
  stars: number;
  score: string;
  timeLabel: string;
  accuracyLabel: string;
  longestWord: string;
  hintsUsed: number;
  rewards: LevelRewardInput;
  onContinue: () => void;
}) {
  const panelRef = useRef<HTMLButtonElement>(null);
  const slots = levelRewardSlots(rewards);
  const earnedStars = Math.max(0, Math.min(3, stars));

  useEffect(() => { panelRef.current?.focus(); }, []);

  return <div className={styles.overlay}>
    {/*
      * There is no separate button: the panel is the affordance. It stays a real <button>
      * so it keeps keyboard focus, Enter/Space and a screen-reader announcement.
      */}
    <button
      ref={panelRef}
      className={styles.panel}
      type="button"
      onClick={onContinue}
      aria-label={`${title}. ${earnedStars} of 3 stars. Tap to continue.`}
    >
      <img className={styles.art} src="/level-complete/panel.webp" alt="" />

      <h1 className={styles.title}>{title}</h1>

      {[0, 1, 2].filter((slot) => slot < earnedStars).map((slot) => (
        <img className={styles.star} data-slot={slot} key={slot} src="/level-complete/star-gold.webp" alt="" />
      ))}

      <span className={`${styles.label} ${styles.scoreLabel}`}>Score</span>
      <span className={`${styles.label} ${styles.timeLabel}`}>Time</span>
      <span className={`${styles.label} ${styles.accuracyLabel}`}>Accuracy</span>
      <span className={`${styles.label} ${styles.longestLabel}`}>Longest Word</span>
      <span className={`${styles.label} ${styles.hintsLabel}`}>Hints</span>
      <span className={`${styles.label} ${styles.rewardLabel}`}>Level Reward</span>

      <span className={`${styles.value} ${styles.score}`}>{score}</span>
      <span className={`${styles.value} ${styles.time}`}>{timeLabel}</span>
      <span className={`${styles.value} ${styles.accuracy}`}>{accuracyLabel}</span>
      <span className={`${styles.value} ${styles.longest}`}>{longestWord || "—"}</span>
      <span className={`${styles.value} ${styles.hints}`}>{hintsUsed}</span>

      <ul className={styles.rewards}>
        {slots.map((slot) => (
          <li className={styles.reward} data-earned={slot.earned} key={slot.kind} aria-label={levelRewardLabel(slot)}>
            <img src={REWARD_ART[slot.kind].src} alt="" aria-hidden="true" />
            <b>{formatRewardAmount(slot)}</b>
          </li>
        ))}
      </ul>

      <span className={styles.tapHint} aria-hidden="true">Tap to continue</span>
    </button>
  </div>;
}
