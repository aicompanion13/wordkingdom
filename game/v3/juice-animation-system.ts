export type FxPoint = Readonly<{ x: number; y: number }>;
export type JuiceBadgeType = "attack" | "steal" | "raid" | "shield";

export type BadgeFlyEffect = {
  kind: "badge-fly";
  id: string;
  badgeType: JuiceBadgeType;
  icon: string;
  sourceTileId: string;
  targetSlotIndex: number;
  source: FxPoint;
  target: FxPoint;
  control1: FxPoint;
  control2: FxPoint;
  bezierPath: string;
  durationMs: number;
  tilePopDurationMs: number;
  trailParticleCount: number;
  trailGlyph: string;
  impactPitchSemitones: number;
};

export type CoinParticle = {
  id: string;
  burst: FxPoint;
  delayMs: number;
  durationMs: number;
  rotation: number;
  scale: number;
  pitchSemitones: number;
};

export type CoinShowerEffect = {
  kind: "coin-shower";
  id: string;
  amount: number;
  source: FxPoint;
  target: FxPoint;
  particles: CoinParticle[];
  durationMs: number;
};

export type CombatImpactEffect = {
  kind: "combat-impact";
  id: string;
  variant: "blocked" | "direct-hit";
  center: FxPoint;
  durationMs: number;
  shardCount: number;
};

export type VaultRevealEffect = {
  kind: "vault-reveal";
  id: string;
  center: FxPoint;
  amount: number;
  durationMs: number;
};

export type JuiceEffect =
  | BadgeFlyEffect
  | CoinShowerEffect
  | CombatImpactEffect
  | VaultRevealEffect;

export type JuiceAnimationConfig = {
  badgeFlyDurationMs: number;
  badgeTrailParticles: number;
  tilePopDurationMs: number;
  coinParticleMin: number;
  coinParticleMax: number;
  coinAttractionDelayMs: number;
  combatImpactDurationMs: number;
  vaultRevealDurationMs: number;
};

export const DEFAULT_JUICE_CONFIG: Readonly<JuiceAnimationConfig> = Object.freeze({
  badgeFlyDurationMs: 380,
  badgeTrailParticles: 8,
  tilePopDurationMs: 150,
  coinParticleMin: 15,
  coinParticleMax: 25,
  coinAttractionDelayMs: 200,
  combatImpactDurationMs: 720,
  vaultRevealDurationMs: 680,
});

const BADGE_VISUALS: Record<JuiceBadgeType, { icon: string; trailGlyph: string }> = {
  attack: { icon: "⚔️", trailGlyph: "◆" },
  steal: { icon: "🃏", trailGlyph: "✧" },
  raid: { icon: "💰", trailGlyph: "✦" },
  shield: { icon: "🛡️", trailGlyph: "⌁" },
};

/**
 * Produces declarative effect descriptions. It knows nothing about React,
 * board state, PvP rules, DOM elements or persistence.
 */
export class JuiceAnimationSystem {
  private readonly config: Readonly<JuiceAnimationConfig>;
  private sequence = 0;
  private randomState = 0x7f4a7c15;

  constructor(config: Partial<JuiceAnimationConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_JUICE_CONFIG, ...config });
  }

  createBadgeFly(input: {
    badgeType: JuiceBadgeType;
    sourceTileId: string;
    targetSlotIndex: number;
    source: FxPoint;
    target: FxPoint;
    now?: number;
  }): BadgeFlyEffect {
    const deltaX = input.target.x - input.source.x;
    const deltaY = input.target.y - input.source.y;
    const lift = Math.max(64, Math.abs(deltaY) * 0.24 + 34);
    const control1 = {
      x: input.source.x + deltaX * 0.24,
      y: input.source.y - lift,
    };
    const control2 = {
      x: input.target.x - deltaX * 0.2,
      y: input.target.y - lift * 0.56,
    };
    const visual = BADGE_VISUALS[input.badgeType];

    return {
      kind: "badge-fly",
      id: this.nextId("badge", input.now),
      badgeType: input.badgeType,
      icon: visual.icon,
      sourceTileId: input.sourceTileId,
      targetSlotIndex: input.targetSlotIndex,
      source: input.source,
      target: input.target,
      control1,
      control2,
      bezierPath: `path("M ${this.round(input.source.x)} ${this.round(input.source.y)} C ${this.round(control1.x)} ${this.round(control1.y)}, ${this.round(control2.x)} ${this.round(control2.y)}, ${this.round(input.target.x)} ${this.round(input.target.y)}")`,
      durationMs: this.config.badgeFlyDurationMs,
      tilePopDurationMs: this.config.tilePopDurationMs,
      trailParticleCount: this.config.badgeTrailParticles,
      trailGlyph: visual.trailGlyph,
      impactPitchSemitones: input.targetSlotIndex,
    };
  }

  createCoinShower(input: {
    amount: number;
    source: FxPoint;
    target: FxPoint;
    particleCount?: number;
    now?: number;
  }): CoinShowerEffect {
    const count = Math.max(
      this.config.coinParticleMin,
      Math.min(
        this.config.coinParticleMax,
        input.particleCount ?? this.config.coinParticleMin + Math.round(this.random() * (this.config.coinParticleMax - this.config.coinParticleMin)),
      ),
    );
    const id = this.nextId("coins", input.now);
    const particles = Array.from({ length: count }, (_, index): CoinParticle => {
      const angle = this.random() * Math.PI * 2;
      const distance = 34 + this.random() * 54;
      return {
        id: `${id}-${index}`,
        burst: {
          x: input.source.x + Math.cos(angle) * distance,
          y: input.source.y + Math.sin(angle) * distance * 0.72,
        },
        delayMs: index * 18,
        durationMs: this.config.coinAttractionDelayMs + 520 + Math.round(this.random() * 170),
        rotation: Math.round((this.random() - 0.5) * 720),
        scale: 0.72 + this.random() * 0.5,
        pitchSemitones: index,
      };
    });
    const durationMs = Math.max(...particles.map((particle) => particle.delayMs + particle.durationMs));

    return {
      kind: "coin-shower",
      id,
      amount: Math.max(0, Math.round(input.amount)),
      source: input.source,
      target: input.target,
      particles,
      durationMs,
    };
  }

  createCombatImpact(input: {
    blocked: boolean;
    center: FxPoint;
    now?: number;
  }): CombatImpactEffect {
    return {
      kind: "combat-impact",
      id: this.nextId("combat", input.now),
      variant: input.blocked ? "blocked" : "direct-hit",
      center: input.center,
      durationMs: this.config.combatImpactDurationMs,
      shardCount: 8,
    };
  }

  createVaultReveal(input: {
    center: FxPoint;
    amount: number;
    now?: number;
  }): VaultRevealEffect {
    return {
      kind: "vault-reveal",
      id: this.nextId("vault", input.now),
      center: input.center,
      amount: Math.max(0, Math.round(input.amount)),
      durationMs: this.config.vaultRevealDurationMs,
    };
  }

  private nextId(prefix: string, now = Date.now()): string {
    return `${prefix}-${now}-${++this.sequence}`;
  }

  private random(): number {
    let value = this.randomState;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.randomState = value >>> 0;
    return this.randomState / 0x100000000;
  }

  private round(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
