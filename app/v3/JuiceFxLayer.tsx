import type { CSSProperties } from "react";
import type {
  BadgeFlyEffect,
  CoinShowerEffect,
  CombatImpactEffect,
  JuiceEffect,
  VaultRevealEffect,
} from "@/game/v3/juice-animation-system";
import styles from "./V3.module.css";

type FxStyle = CSSProperties & Record<`--${string}`, string | number>;

export function JuiceFxLayer({ effects }: { effects: JuiceEffect[] }) {
  if (effects.length === 0) return null;

  return <div className={styles.juiceFxLayer} aria-hidden="true">
    {effects.map((effect) => {
      if (effect.kind === "badge-fly") return <BadgeFly effect={effect} key={effect.id} />;
      if (effect.kind === "coin-shower") return <CoinShower effect={effect} key={effect.id} />;
      if (effect.kind === "combat-impact") return <CombatImpact effect={effect} key={effect.id} />;
      return <VaultReveal effect={effect} key={effect.id} />;
    })}
  </div>;
}

function BadgeFly({ effect }: { effect: BadgeFlyEffect }) {
  const pathStyle = {
    "--fx-path": effect.bezierPath,
    "--fx-duration": `${effect.durationMs}ms`,
  } as FxStyle;

  return <div className={styles.badgeFxGroup} data-badge={effect.badgeType}>
    {Array.from({ length: effect.trailParticleCount }, (_, index) => <i
      className={styles.badgeTrailParticle}
      key={`${effect.id}-trail-${index}`}
      style={{
        ...pathStyle,
        "--fx-delay": `${38 + index * 24}ms`,
        "--fx-scale": 1 - index * 0.065,
      } as FxStyle}
    >{effect.trailGlyph}</i>)}
    <b className={styles.badgeFlight} style={pathStyle}>{effect.icon}</b>
  </div>;
}

function CoinShower({ effect }: { effect: CoinShowerEffect }) {
  return <div className={styles.coinShowerFx}>
    {effect.particles.map((particle) => <i
      key={particle.id}
      style={{
        "--coin-sx": `${effect.source.x}px`,
        "--coin-sy": `${effect.source.y}px`,
        "--coin-bx": `${particle.burst.x}px`,
        "--coin-by": `${particle.burst.y}px`,
        "--coin-tx": `${effect.target.x}px`,
        "--coin-ty": `${effect.target.y}px`,
        "--coin-delay": `${particle.delayMs}ms`,
        "--coin-duration": `${particle.durationMs}ms`,
        "--coin-rotation": `${particle.rotation}deg`,
        "--coin-scale": particle.scale,
      } as FxStyle}
    >●</i>)}
  </div>;
}

function CombatImpact({ effect }: { effect: CombatImpactEffect }) {
  const centerStyle = {
    "--impact-x": `${effect.center.x}px`,
    "--impact-y": `${effect.center.y}px`,
    "--impact-duration": `${effect.durationMs}ms`,
  } as FxStyle;

  return <div className={styles.combatImpactFx} data-variant={effect.variant} style={centerStyle}>
    <i className={styles.combatFlash} />
    <b className={styles.combatShield}>{effect.variant === "blocked" ? "🛡️" : "💰"}</b>
    <span className={styles.combatDaggers}>⚔️</span>
    {Array.from({ length: effect.shardCount }, (_, index) => <em
      key={`${effect.id}-shard-${index}`}
      style={{ "--shard-angle": `${index * (360 / effect.shardCount)}deg` } as FxStyle}
    >◆</em>)}
  </div>;
}

function VaultReveal({ effect }: { effect: VaultRevealEffect }) {
  return <div className={styles.vaultRevealFx} style={{
    "--vault-x": `${effect.center.x}px`,
    "--vault-y": `${effect.center.y}px`,
    "--vault-duration": `${effect.durationMs}ms`,
  } as FxStyle}>
    <i />
    <b>+{effect.amount.toLocaleString("en")} COINS!</b>
  </div>;
}
