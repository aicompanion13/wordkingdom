"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import styles from "./FtueCoachmarks.module.css";
import tutorialStyles from "./TutorialCard.module.css";

export type DiscoveryArtworkKind = "coral-castle" | "pearl" | "sea-turtle" | "album";

type Point = { x: number; y: number };
type RectShape = { left: number; top: number; width: number; height: number };

export function DiscoveryArtwork({ kind, className = "" }: { kind: DiscoveryArtworkKind; className?: string }) {
  return <span className={`${styles.discoveryArtwork} ${className}`} data-artwork={kind} aria-hidden="true" />;
}

export function FtueCoachmark({
  icon,
  title,
  message,
  targetRef,
  swipeTileIds = [],
  gesture,
  dim = false,
  reducedMotion = false,
  messageOpen = true,
  onDismiss,
  testId,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  targetRef?: RefObject<HTMLElement | null>;
  swipeTileIds?: string[];
  gesture?: "tap" | "swipe";
  dim?: boolean;
  reducedMotion?: boolean;
  messageOpen?: boolean;
  onDismiss?: () => void;
  testId?: string;
}) {
  const [target, setTarget] = useState<RectShape | null>(null);
  const [path, setPath] = useState<Point[]>([]);

  useLayoutEffect(() => {
    const measure = () => {
      const targetRect = targetRef?.current?.getBoundingClientRect();
      setTarget(targetRect ? {
        left: targetRect.left,
        top: targetRect.top,
        width: targetRect.width,
        height: targetRect.height,
      } : null);
      setPath(swipeTileIds.flatMap((id) => {
        const tile = document.querySelector<HTMLElement>(`[data-v3-tile-id="${id}"]`);
        if (!tile) return [];
        const rect = tile.getBoundingClientRect();
        return [{ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }];
      }));
    };
    measure();
    const timer = window.setInterval(measure, 300);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [swipeTileIds.join("|"), targetRef]);

  const start = path[0];
  const end = path.at(-1);
  const fingerStyle = start && end ? {
    "--finger-x": `${start.x}px`,
    "--finger-y": `${start.y}px`,
    "--finger-dx": `${end.x - start.x}px`,
    "--finger-dy": `${end.y - start.y}px`,
  } as CSSProperties : target ? {
    "--finger-x": `${target.left + target.width * 0.64}px`,
    "--finger-y": `${target.top + target.height * 0.62}px`,
    "--finger-dx": "0px",
    "--finger-dy": "0px",
  } as CSSProperties : undefined;

  return <div className={styles.coachRoot} data-testid={testId} data-reduced-motion={reducedMotion ? "true" : undefined} data-message-open={messageOpen ? "true" : "false"}>
    {messageOpen && onDismiss && <button className={styles.dismissLayer} type="button" onClick={onDismiss} aria-label="Dismiss tutorial message" />}
    {dim && messageOpen && <div className={styles.dimmer} aria-hidden="true" />}
    {target && <div className={styles.spotlight} style={{ left: target.left - 6, top: target.top - 6, width: target.width + 12, height: target.height + 12 }} aria-hidden="true" />}
    {path.length > 1 && <div className={styles.swipePath} style={{ left: start!.x, top: start!.y, width: Math.hypot(end!.x - start!.x, end!.y - start!.y), transform: `rotate(${Math.atan2(end!.y - start!.y, end!.x - start!.x)}rad)` }} aria-hidden="true" />}
    {messageOpen && <aside className={styles.coachCard} role="dialog" aria-modal="true" aria-live="polite">
      <div className={styles.coachIcon}>{icon}</div>
      <div><b>{title}</b><p>{message}</p></div>
      {onDismiss && <button className={styles.coachClose} type="button" onClick={onDismiss} aria-label="Close tutorial message">X</button>}
    </aside>}
    {gesture && fingerStyle && !messageOpen && <img className={`${styles.finger} ${gesture === "swipe" ? styles.swipeFinger : styles.tapFinger}`} style={fingerStyle} src="/royal-finger-pointer.png?v=20260805" alt="" aria-hidden="true" />}
  </div>;
}

export function ConceptCard({
  title,
  message,
  cta,
  icon = "👑",
  messageOpen = true,
  onDismiss,
  testId,
}: {
  title: string;
  message: string;
  cta: string;
  icon?: ReactNode;
  messageOpen?: boolean;
  onDismiss: () => void;
  testId?: string;
}) {
  const ctaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!messageOpen) return;
    ctaRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onDismiss(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [messageOpen, onDismiss]);

  if (!messageOpen) return null;
  return <div
    className={tutorialStyles.overlay}
    data-testid={testId}
    onClick={(event) => { if (event.target === event.currentTarget) onDismiss(); }}
  >
    <section className={tutorialStyles.card} role="dialog" aria-modal="true" aria-labelledby="tutorial-card-title">
      <img className={tutorialStyles.frame} src="/tutorial/word-kingdom-tutorial-card-frame.webp" alt="" />
      <button className={tutorialStyles.close} type="button" onClick={onDismiss} aria-label="Close">×</button>
      <div className={tutorialStyles.copy}>
        <span className={tutorialStyles.topicIcon} aria-hidden="true">{icon}</span>
        <h2 id="tutorial-card-title" className={tutorialStyles.title}>{title}</h2>
        <p className={tutorialStyles.body}>{message}</p>
      </div>
      <div className={tutorialStyles.actions}>
        <button ref={ctaRef} className={tutorialStyles.cta} type="button" onClick={onDismiss}>{cta}</button>
      </div>
    </section>
  </div>;
}

export function DiscoveryMessage({
  artwork,
  title,
  message,
  count,
}: {
  artwork: Exclude<DiscoveryArtworkKind, "album">;
  title: string;
  message: string;
  count: number;
}) {
  return <aside className={styles.discoveryMessage} data-discovery={artwork} role="status" aria-live="polite">
    <DiscoveryArtwork kind={artwork} />
    <div><b>{title}</b><p>{message}</p><span>{count}/3</span></div>
  </aside>;
}
