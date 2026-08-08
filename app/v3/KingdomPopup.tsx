import type { CSSProperties, ReactNode } from "react";
import styles from "./KingdomPopup.module.css";

const CONFETTI_COLORS = ["#ffd452", "#20d7ca", "#e8503a", "#4f8ef7", "#8753b9"];

export function KingdomPopup({
  title,
  subtitle,
  icon = "👑",
  tone = "success",
  ctaText,
  onCta,
  secondaryText,
  onSecondary,
  onClose,
  celebrate = true,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  tone?: "success" | "setback";
  ctaText?: ReactNode;
  onCta?: () => void;
  secondaryText?: ReactNode;
  onSecondary?: () => void;
  onClose?: () => void;
  celebrate?: boolean;
  children?: ReactNode;
}) {
  return <div
    className={styles.overlay}
    onClick={onClose ? (event) => { if (event.target === event.currentTarget) onClose(); } : undefined}
  >
    <section className={styles.sign} data-tone={tone} role="dialog" aria-modal="true" aria-labelledby="kingdom-popup-title">
      {onClose && <button className={styles.closeButton} onClick={onClose} aria-label="Close">×</button>}
      {celebrate && <div className={styles.confetti} aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => <i
          key={index}
          style={{ "--angle": `${index * 36}deg`, "--delay": `${(index % 5) * 90}ms`, "--tint": CONFETTI_COLORS[index % CONFETTI_COLORS.length] } as CSSProperties}
        />)}
      </div>}
      <div className={styles.crest} aria-hidden="true">
        <i className={styles.crestRibbon} />
        <span className={styles.crestTile}>W</span>
        <span className={styles.crestMedal}><b>{icon}</b></span>
        <span className={styles.crestTile}>K</span>
      </div>
      <h1 id="kingdom-popup-title" className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {children && <div className={styles.body}>{children}</div>}
      {ctaText && <button className={styles.cta} onClick={onCta}>{ctaText}</button>}
      {secondaryText && <button className={styles.secondary} onClick={onSecondary}>{secondaryText}</button>}
    </section>
  </div>;
}
