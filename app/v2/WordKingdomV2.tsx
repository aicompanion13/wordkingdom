"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import areasJson from "@/game/v2/data/areas.json";
import defaultPlayerJson from "@/game/v2/data/default-player.json";
import { BoardController } from "@/game/v2/board-controller";
import { DirectorSystem } from "@/game/v2/director-system";
import { ScoreManager } from "@/game/v2/score-manager";
import { BadgeManager } from "@/game/v2/badge-manager";
import {
  buildingCoinCost, buildingStarCost, EconomyManager, ENERGY_CAP, ENERGY_REGEN_MS,
} from "@/game/v2/economy-manager";
import type {
  ActiveWord, AreaBuildingDefinition, AreaDefinition, BadgeType, BoardSnapshot,
  MetaEvent, PlayerSettings, PlayerState, Position, RunSummary, ScoreSnapshot, Tile,
} from "@/game/v2/types";
import styles from "./V2.module.css";

const areas = areasJson as AreaDefinition[];
const STORAGE_KEY = "word-kingdom-v2-player";
const EMPTY_SCORE: ScoreSnapshot = { score: 0, combo: 1, correct: 0, attempts: 0, hints: 0, longestWord: "" };
const BADGE_UI: Record<BadgeType, { icon: string; label: string }> = {
  attack: { icon: "⚔", label: "Attack" }, steal: { icon: "🃏", label: "Steal" }, raid: { icon: "💰", label: "Raid" }, shield: { icon: "🛡", label: "Shield" },
};

type Screen = "village" | "board" | "summary";
type HubTab = "shop" | "teams" | "home" | "events" | "map";

function freshPlayer(): PlayerState {
  const source = defaultPlayerJson as PlayerState;
  return {
    ...source,
    energyUpdatedAt: Date.now(),
    unlockedAreaIds: [...source.unlockedAreaIds],
    claimedAreaRewards: [...source.claimedAreaRewards],
    areaProgress: Object.fromEntries(Object.entries(source.areaProgress).map(([key, value]) => [key, { ...value }])),
    recentWordsByArea: Object.fromEntries(Object.entries(source.recentWordsByArea).map(([key, value]) => [key, [...value]])),
    settings: { ...source.settings },
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

function formatEnergyTimer(player: PlayerState, now: number): string {
  if (player.energy >= ENERGY_CAP) return "FULL";
  const elapsed = Math.max(0, now - player.energyUpdatedAt);
  const remaining = Math.max(0, ENERGY_REGEN_MS - (elapsed % ENERGY_REGEN_MS));
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildingLevel(player: PlayerState, areaId: number, buildingId: string): number {
  return player.areaProgress[String(areaId)]?.[buildingId] ?? 0;
}

function areaBuiltLevels(player: PlayerState, area: AreaDefinition): number {
  return area.visualAssets.buildings.reduce((sum, building) => sum + buildingLevel(player, area.areaId, building.id), 0);
}

function samePath(first: string[], second: string[]): boolean {
  if (first.length !== second.length) return false;
  const forward = first.every((id, index) => id === second[index]);
  const reverse = first.every((id, index) => id === second[second.length - index - 1]);
  return forward || reverse;
}

export default function WordKingdomV2() {
  const [hydrated, setHydrated] = useState(false);
  const [player, setPlayer] = useState<PlayerState>(freshPlayer);
  const [screen, setScreen] = useState<Screen>("village");
  const [hubTab, setHubTab] = useState<HubTab>("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [activeWords, setActiveWords] = useState<ActiveWord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clearingIds, setClearingIds] = useState<string[]>([]);
  const [hintedId, setHintedId] = useState<string | null>(null);
  const [cascades, setCascades] = useState(0);
  const [score, setScore] = useState<ScoreSnapshot>(EMPTY_SCORE);
  const [badgeCounts, setBadgeCounts] = useState<Record<BadgeType, number>>({ attack: 0, steal: 0, raid: 0, shield: 0 });
  const [metaEvent, setMetaEvent] = useState<MetaEvent | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [message, setMessage] = useState("Find one of the active words");
  const [animating, setAnimating] = useState(false);
  const [shake, setShake] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);

  const boardController = useRef<BoardController | null>(null);
  const director = useRef<DirectorSystem | null>(null);
  const scoreManager = useRef<ScoreManager | null>(null);
  const badgeManager = useRef<BadgeManager | null>(null);
  const economy = useRef<EconomyManager | null>(null);
  const runStartedAt = useRef(0);
  const runAreaId = useRef(1);
  const runLevelNumber = useRef(1);
  const eventCoins = useRef(0);
  const selectionRef = useRef<string[]>([]);
  const dragStart = useRef<Position | null>(null);
  const dragging = useRef(false);

  const savePlayer = (next: PlayerState) => {
    setPlayer(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* local saves are optional */ }
  };

  useEffect(() => {
    let restored = freshPlayer();
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PlayerState;
        if (parsed.version === 3) {
          const defaults = freshPlayer();
          restored = { ...defaults, ...parsed, recentWordsByArea: parsed.recentWordsByArea ?? defaults.recentWordsByArea };
        }
      }
    } catch { /* local saves are optional */ }
    const manager = new EconomyManager(restored);
    economy.current = manager;
    setPlayer(manager.snapshot());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hydrated || !economy.current || player.energy >= ENERGY_CAP) return;
    const regenerated = economy.current.regenerate(clock);
    if (regenerated.energy !== player.energy) savePlayer(regenerated);
  }, [clock, hydrated, player.energy]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeArea = areas.find((candidate) => candidate.areaId === player.currentAreaId) ?? areas[0];
  const runArea = areas.find((candidate) => candidate.areaId === runAreaId.current) ?? activeArea;
  const area = screen === "board" || screen === "summary" ? runArea : activeArea;
  const energyTimer = formatEnergyTimer(player, clock);
  const badgeByTile = useMemo(() => {
    const map = new Map<string, BadgeType>();
    activeWords.forEach((word) => word.badges.forEach((badge) => map.set(badge.tileId, badge.type)));
    return map;
  }, [activeWords]);

  const updateSelection = (path: Position[]) => {
    const ids = boardController.current?.tileIdsForPath(path).filter(Boolean) ?? [];
    selectionRef.current = ids;
    setSelectedIds(ids);
  };

  const startRun = () => {
    const economyManager = economy.current;
    if (!economyManager || !economyManager.spendEnergy(1)) {
      setToast("You need one Energy ticket to play.");
      return;
    }
    const nextPlayer = economyManager.snapshot();
    savePlayer(nextPlayer);
    const currentArea = areas.find((candidate) => candidate.areaId === nextPlayer.currentAreaId) ?? areas[0];
    const seed = (Date.now() ^ currentArea.areaId * 7919 ^ nextPlayer.currentLevel * 3571) >>> 0;
    const nextBoard = new BoardController(8, seed);
    const recentWords = nextPlayer.recentWordsByArea?.[String(currentArea.areaId)] ?? [];
    const nextDirector = new DirectorSystem(currentArea, seed, recentWords);
    const decision = nextDirector.activate(nextBoard, 0, "initial");
    boardController.current = nextBoard;
    director.current = nextDirector;
    scoreManager.current = new ScoreManager(Date.now());
    badgeManager.current = new BadgeManager();
    runStartedAt.current = Date.now();
    runAreaId.current = currentArea.areaId;
    runLevelNumber.current = nextPlayer.currentLevel;
    eventCoins.current = 0;
    setBoard(nextBoard.snapshot());
    setActiveWords(decision.activeWords);
    setCascades(0);
    setScore(EMPTY_SCORE);
    setBadgeCounts({ attack: 0, steal: 0, raid: 0, shield: 0 });
    setSelectedIds([]);
    selectionRef.current = [];
    setClearingIds([]);
    setSummary(null);
    setMessage("The Current reveals three living words");
    setScreen("board");
  };

  const finishRun = () => {
    const manager = scoreManager.current;
    const economyManager = economy.current;
    if (!manager || !economyManager) return;
    const elapsed = Math.max(1, Math.round((Date.now() - runStartedAt.current) / 1000));
    const result = manager.finalize(elapsed, eventCoins.current);
    economyManager.awardRun(result.totalCoins, result.stars);
    economyManager.rememberWords(runAreaId.current, director.current?.shownWords() ?? []);
    economyManager.advanceLevel();
    savePlayer(economyManager.snapshot());
    setSummary(result);
    setScreen("summary");
    setAnimating(false);
  };

  const solveWord = (word: ActiveWord) => {
    if (animating || !boardController.current || !director.current || !scoreManager.current || !badgeManager.current) return;
    setAnimating(true);
    selectionRef.current = word.tileIds;
    setSelectedIds(word.tileIds);
    setClearingIds(word.tileIds);
    const points = scoreManager.current.recordCorrect(word.word, Date.now());
    setScore(scoreManager.current.snapshot());
    const badgeResult = badgeManager.current.collect(word);
    setBadgeCounts(badgeResult.counts);
    setMessage(`+${formatNumber(points)} · ${word.word}!`);
    window.setTimeout(() => {
      const boardEngine = boardController.current;
      const directorEngine = director.current;
      if (!boardEngine || !directorEngine) return;
      boardEngine.clearPath(word.path);
      directorEngine.notifyWordCleared(word);
      const nextCascade = cascades + 1;
      setCascades(nextCascade);
      setClearingIds([]);
      setSelectedIds([]);
      selectionRef.current = [];
      setBoard(boardEngine.snapshot());
      if (nextCascade >= 5) {
        window.setTimeout(finishRun, 420);
        return;
      }
      const decision = directorEngine.activate(boardEngine, nextCascade, "cascade");
      setBoard(boardEngine.snapshot());
      setActiveWords(decision.activeWords);
      setAnimating(false);
      if (badgeResult.event) setMetaEvent(badgeResult.event);
      else setMessage(`${5 - nextCascade} cascades remain`);
    }, 360);
  };

  const submitSelection = () => {
    if (selectionRef.current.length < 2 || animating) return;
    const match = activeWords.find((word) => samePath(selectionRef.current, word.tileIds));
    if (match) { solveWord(match); return; }
    scoreManager.current?.recordIncorrect();
    if (scoreManager.current) setScore(scoreManager.current.snapshot());
    setMessage("That word is sleeping — follow the Active Rail");
    setShake(true);
    window.setTimeout(() => setShake(false), 380);
    selectionRef.current = [];
    setSelectedIds([]);
  };

  const onPointerDown = (tile: Tile) => {
    if (animating) return;
    dragging.current = true;
    let start = { row: tile.row, col: tile.col };
    if (selectionRef.current.length === 1 && selectionRef.current[0] !== tile.id && boardController.current) {
      const firstTile = board?.tiles.flat().find((candidate) => candidate.id === selectionRef.current[0]);
      if (firstTile) start = { row: firstTile.row, col: firstTile.col };
    }
    dragStart.current = start;
    const path = boardController.current?.pathBetween(start, { row: tile.row, col: tile.col }) ?? [];
    updateSelection(path.length ? path : [{ row: tile.row, col: tile.col }]);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !dragStart.current || !boardController.current) return;
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-v2-tile-id]");
    const tileId = element?.dataset.v2TileId;
    const tile = board?.tiles.flat().find((candidate) => candidate.id === tileId);
    if (!tile) return;
    const path = boardController.current.pathBetween(dragStart.current, { row: tile.row, col: tile.col });
    if (path.length) updateSelection(path);
  };

  const onPointerUp = () => {
    dragging.current = false;
    dragStart.current = null;
    if (selectionRef.current.length > 1) submitSelection();
  };

  const onKeyboardTile = (tile: Tile) => {
    if (animating) return;
    if (selectionRef.current.length === 0 || selectionRef.current.length > 1) {
      updateSelection([{ row: tile.row, col: tile.col }]);
      return;
    }
    const first = board?.tiles.flat().find((candidate) => candidate.id === selectionRef.current[0]);
    if (!first || !boardController.current) return;
    const path = boardController.current.pathBetween(first, tile);
    if (path.length > 1) { updateSelection(path); window.setTimeout(submitSelection, 0); }
  };

  const useHint = () => {
    const target = activeWords[0];
    if (!target || animating) return;
    scoreManager.current?.useHint();
    if (scoreManager.current) setScore(scoreManager.current.snapshot());
    setHintedId(target.tileIds[0]);
    setMessage(`${target.word} begins here — combo reset`);
    window.setTimeout(() => setHintedId(null), 1800);
  };

  const chooseEvent = (index: number) => {
    if (!metaEvent) return;
    if (metaEvent.type === "shield") {
      economy.current?.awardRun(0, 0, 1);
      if (economy.current) savePlayer(economy.current.snapshot());
      setMessage("Shield stored — your kingdom is protected");
    } else {
      const rewards = metaEvent.type === "attack" ? [140, 220, 320] : [180, 280, 420];
      const reward = rewards[index];
      eventCoins.current += reward;
      setMessage(`Royal strike! +${reward} event coins`);
    }
    setMetaEvent(null);
  };

  const buildNextTask = (building: AreaBuildingDefinition) => {
    if (!economy.current) return;
    const oldLevel = buildingLevel(player, activeArea.areaId, building.id);
    if (economy.current.build(activeArea, building)) {
      savePlayer(economy.current.snapshot());
      setToast(`${building.name} upgraded to Level ${oldLevel + 1}!`);
    }
  };

  const claimAreaReward = () => {
    if (!economy.current) return;
    const nextArea = areas.find((candidate) => candidate.areaId === activeArea.areaId + 1);
    if (economy.current.claimAreaReward(activeArea, nextArea?.areaId)) {
      savePlayer(economy.current.snapshot());
      setToast(nextArea ? `${nextArea.displayName} unlocked!` : "The whole kingdom is restored!");
    }
  };

  const selectArea = (areaId: number) => {
    if (!economy.current || !economy.current.setActiveArea(areaId)) return;
    savePlayer(economy.current.snapshot());
    setHubTab("home");
  };

  const updateSetting = (key: keyof PlayerSettings) => {
    if (!economy.current) return;
    savePlayer(economy.current.updateSetting(key, !player.settings[key]));
  };

  const debugAddResources = () => {
    if (!economy.current) return;
    savePlayer(economy.current.debugAdd(5000, 5, 20));
    setToast("QA resources added");
  };

  const debugCompleteArea = () => {
    if (!economy.current) return;
    savePlayer(economy.current.debugCompleteArea(activeArea));
    setToast(`${activeArea.displayName} marked complete`);
  };

  const resetV2Save = () => {
    economy.current = new EconomyManager(freshPlayer());
    savePlayer(economy.current.snapshot());
    setDebugOpen(false);
    setHubTab("home");
    setToast("Version 2 save reset");
  };

  const debugEvent = (type: BadgeType) => {
    if (badgeManager.current) setMetaEvent(badgeManager.current.debugFill(type));
  };

  const openShop = () => {
    setScreen("village");
    setHubTab("shop");
  };

  const returnHome = () => {
    setScreen("village");
    setHubTab("home");
  };

  if (screen === "village") {
    const built = areaBuiltLevels(player, activeArea);
    const nextTask = activeArea.visualAssets.buildings.find((building) => buildingLevel(player, activeArea.areaId, building.id) < building.maxLevel);
    const taskLevel = nextTask ? buildingLevel(player, activeArea.areaId, nextTask.id) : 0;
    const taskCoins = nextTask ? buildingCoinCost(nextTask, taskLevel) : 0;
    const taskStars = nextTask ? buildingStarCost(taskLevel) : 0;
    const rewardClaimed = player.claimedAreaRewards.includes(activeArea.areaId);
    return (
      <main className={`${styles.shell} ${styles.hubShell}`} data-theme={activeArea.themeKey} style={{ "--area-accent": activeArea.accent } as CSSProperties}>
        <HubTopBar player={player} energyTimer={energyTimer} onShop={openShop} onSettings={() => setSettingsOpen(true)} />
        <section className={styles.hubContent}>
          {hubTab === "home" ? (
            <HomeHub
              area={activeArea}
              player={player}
              built={built}
              nextTask={nextTask}
              taskLevel={taskLevel}
              taskCoins={taskCoins}
              taskStars={taskStars}
              rewardClaimed={rewardClaimed}
              hydrated={hydrated}
              onPlay={startRun}
              onBuild={() => nextTask && buildNextTask(nextTask)}
              onClaim={claimAreaReward}
            />
          ) : hubTab === "map" ? (
            <MapPanel player={player} onSelect={selectArea} />
          ) : hubTab === "shop" ? (
            <ShopPanel onAction={() => setToast("Shop checkout will connect in the economy phase")}/>
          ) : hubTab === "teams" ? (
            <TeamsPanel onAction={() => setToast("Life request sent to the Royal Wordsmiths")}/>
          ) : (
            <EventsPanel onAction={() => setToast("Raid Tournament pinned to your event rail")}/>
          )}
        </section>
        <BottomNav active={hubTab} onChange={setHubTab} />
        {hubTab === "home" && <button className={styles.hubDebugToggle} onClick={() => setDebugOpen((open) => !open)}>⚙ Royal QA</button>}
        {debugOpen && hubTab === "home" && <div className={styles.hubDebugDock}><b>LOCAL QA TOOLS</b><button onClick={debugAddResources}>+ Resources</button><button onClick={debugCompleteArea}>Complete Area</button><button onClick={resetV2Save}>Reset Save</button></div>}
        {settingsOpen && <SettingsModal player={player} onToggle={updateSetting} onClose={() => setSettingsOpen(false)} />}
        {toast && <div className={styles.toast} role="status">{toast}</div>}
      </main>
    );
  }

  if (screen === "summary" && summary) {
    return (
      <main className={`${styles.shell} ${styles.summaryShell}`}>
        <GameTopBar player={player} energyTimer={energyTimer} onBack={returnHome} onShop={openShop} onSettings={() => setSettingsOpen(true)} />
        <section className={styles.summaryCard}>
          <div className={styles.summaryCrown}>♛</div>
          <span className={styles.kicker}>Level {runLevelNumber.current} · {runArea.displayName}</span>
          <h1>Kingdom restored!</h1>
          <div className={styles.stars} aria-label={`${summary.stars} stars earned`}>{[1, 2, 3].map((star) => <span className={star <= summary.stars ? styles.starEarned : ""} key={star}>★</span>)}</div>
          <div className={styles.summaryGrid}>
            <Result label="Score" value={formatNumber(summary.score)} /><Result label="Time" value={`${summary.elapsedSeconds}s`} /><Result label="Accuracy" value={`${Math.round(summary.accuracy * 100)}%`} /><Result label="Longest" value={summary.longestWord || "—"} /><Result label="Hints" value={String(summary.hints)} /><Result label="Event loot" value={`+${summary.eventCoins}`} />
          </div>
          <div className={styles.payout}><span>Royal payout</span><b>🪙 {formatNumber(summary.totalCoins)} · ★ {summary.stars}</b><small>{summary.stars === 3 ? "1.5×" : summary.stars === 2 ? "1.25×" : "1×"} mastery multiplier applied</small></div>
          <button className={styles.primaryCta} onClick={startRun} disabled={player.energy < 1}>Play Level {player.currentLevel}<small>1 ⚡ Ticket</small></button>
          <button className={styles.secondaryCta} onClick={returnHome}>Return to Kingdom</button>
        </section>
        {settingsOpen && <SettingsModal player={player} onToggle={updateSetting} onClose={() => setSettingsOpen(false)} />}
      </main>
    );
  }

  return (
    <main className={`${styles.shell} ${styles.boardShell}`} style={{ "--level-accent": area.accent } as CSSProperties}>
      <GameTopBar player={player} energyTimer={energyTimer} onBack={returnHome} onShop={openShop} onSettings={() => setSettingsOpen(true)} />
      <section className={styles.runHeader}>
        <div><span className={styles.kicker}>{area.icon} {area.displayName} · Level {runLevelNumber.current}</span><h1>Living Board</h1><small className={styles.obstaclePreview}>Obstacle set: {area.obstaclePalette.map((item) => `${item.icon} ${item.name}`).join(" · ")}</small></div>
        <div className={styles.cascadeCounter}><b>{cascades}</b><span>/ 5</span><small>Cascades</small></div>
      </section>
      <div className={styles.cascadeTrack}><i style={{ width: `${(cascades / 5) * 100}%` }} /></div>
      <section className={styles.activeRail} aria-label="Active words">
        <div className={styles.railHeading}><span>Active in the Current</span><small>{area.themeKey.replaceAll("_", " ")}</small></div>
        <div className={styles.activeWords}>
          {activeWords.map((word) => <div className={styles.activeWordChip} key={word.id}><span>{word.word}</span>{word.badges.map((badge) => <i data-badge={badge.type} key={badge.tileId}>{BADGE_UI[badge.type].icon}</i>)}</div>)}
          <div className={styles.lockedWord}>🔒 Next word concealed</div>
        </div>
      </section>
      <section className={styles.collectionRail} aria-label="Badge collection">
        {(Object.keys(BADGE_UI) as BadgeType[]).map((type) => <div key={type} data-type={type}><b>{BADGE_UI[type].icon}</b><span>{BADGE_UI[type].label}</span><div>{[0, 1, 2].map((slot) => <i className={slot < badgeCounts[type] ? styles.collected : ""} key={slot} />)}</div></div>)}
      </section>
      <section className={styles.boardLayout}>
        <div className={`${styles.boardCard} ${shake ? styles.shake : ""}`}>
          <div className={styles.boardMessage}>{message}</div>
          <div className={styles.letterGrid} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label="Living word board">
            {board?.tiles.flat().map((tile) => {
              const badge = badgeByTile.get(tile.id);
              const selected = selectedIds.includes(tile.id);
              return <button key={tile.id} data-v2-tile-id={tile.id} className={`${styles.tile} ${selected ? styles.selected : ""} ${clearingIds.includes(tile.id) ? styles.clearing : ""} ${hintedId === tile.id ? styles.hinted : ""} ${badge ? styles.badged : ""}`} onPointerDown={() => onPointerDown(tile)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onKeyboardTile(tile); } }} aria-label={`${tile.letter}${badge ? `, ${BADGE_UI[badge].label} badge` : ""}`}><span>{tile.letter}</span>{badge && <i data-badge={badge}>{BADGE_UI[badge].icon}</i>}</button>;
            })}
          </div>
          <div className={styles.boardActions}><button onClick={useHint} disabled={animating}>💡 Hint <small>resets combo</small></button><span>Drag or tap two endpoints</span></div>
        </div>
        <aside className={styles.runPanel}>
          <div className={styles.scoreHero}><span>Royal score</span><b>{formatNumber(score.score)}</b><i>{score.combo.toFixed(1)}× combo</i></div>
          <div className={styles.runStats}><Result label="Accuracy" value={`${score.attempts ? Math.round((score.correct / score.attempts) * 100) : 100}%`} /><Result label="Longest" value={score.longestWord || "—"} /><Result label="Hints" value={String(score.hints)} /><Result label="Words" value={`${score.correct}/5`} /></div>
          <button className={styles.debugToggle} onClick={() => setDebugOpen((open) => !open)}>⚙ Royal QA Tools</button>
          {debugOpen && <div className={styles.boardDebug}><span>DEBUG OPTIONS</span><button onClick={() => activeWords[0] && solveWord(activeWords[0])}>Auto-solve current word</button><button onClick={() => debugEvent("attack")}>Trigger Attack</button><button onClick={() => debugEvent("raid")}>Trigger Raid</button><button onClick={() => debugEvent("shield")}>Grant Shield</button></div>}
        </aside>
      </section>
      {metaEvent && <MetaEventOverlay event={metaEvent} onChoose={chooseEvent} />}
      {settingsOpen && <SettingsModal player={player} onToggle={updateSetting} onClose={() => setSettingsOpen(false)} />}
    </main>
  );
}

function HubTopBar({ player, energyTimer, onShop, onSettings }: { player: PlayerState; energyTimer: string; onShop: () => void; onSettings: () => void }) {
  return <header className={styles.hubTopBar}><button className={styles.miniProfile} aria-label="Player profile"><span>👑</span><i>14</i></button><Resource icon="⚡" value={`${player.energy}/${ENERGY_CAP}`} sub={energyTimer} /><Resource icon="★" value={String(player.stars)} /><button className={styles.coinResource} onClick={onShop}><span>🪙</span><b>{formatNumber(player.coins)}</b><i>+</i></button><button className={styles.settingsButton} onClick={onSettings} aria-label="Settings">⚙</button></header>;
}

function GameTopBar({ player, energyTimer, onBack, onShop, onSettings }: { player: PlayerState; energyTimer: string; onBack: () => void; onShop: () => void; onSettings: () => void }) {
  return <header className={styles.gameTopBar}><button className={styles.gameBack} onClick={onBack} aria-label="Back to kingdom">‹</button><Resource icon="⚡" value={`${player.energy}/${ENERGY_CAP}`} sub={energyTimer} /><Resource icon="★" value={String(player.stars)} /><button className={styles.coinResource} onClick={onShop}><span>🪙</span><b>{formatNumber(player.coins)}</b><i>+</i></button><button className={styles.settingsButton} onClick={onSettings} aria-label="Settings">⚙</button></header>;
}

function Resource({ icon, value, sub }: { icon: string; value: string; sub?: string }) {
  return <div className={styles.navResource}><span>{icon}</span><b>{value}</b>{sub && <small>{sub}</small>}</div>;
}

function HomeHub({ area, player, built, nextTask, taskLevel, taskCoins, taskStars, rewardClaimed, hydrated, onPlay, onBuild, onClaim }: { area: AreaDefinition; player: PlayerState; built: number; nextTask?: AreaBuildingDefinition; taskLevel: number; taskCoins: number; taskStars: number; rewardClaimed: boolean; hydrated: boolean; onPlay: () => void; onBuild: () => void; onClaim: () => void }) {
  const canBuild = !!nextTask && player.coins >= taskCoins && player.stars >= taskStars;
  return <div className={styles.homeHub}>
    <section className={styles.areaStage} data-theme={area.themeKey} aria-label={`${area.displayName} live preview`}>
      <div className={styles.areaParticles}>{Array.from({ length: 9 }, (_, index) => <i key={index}>{area.icon}</i>)}</div>
      <div className={styles.areaTitle}><small>AREA {area.areaId} · {area.themeKey.replaceAll("_", " ")}</small><h1>{area.displayName}</h1><p>{area.subtitle}</p><div><span>{built}/25 restored</span><i><b style={{ width: `${(built / 25) * 100}%` }} /></i></div></div>
      <div className={styles.areaBuildings}>{area.visualAssets.buildings.map((building, index) => { const level = buildingLevel(player, area.areaId, building.id); return <div className={`${styles.liveBuilding} ${level === 0 ? styles.unbuilt : ""}`} style={{ "--building-index": index } as CSSProperties} key={building.id}><span>{level === 0 ? "🔒" : building.icon}</span><b>{building.name}</b><small>Lv. {level}</small></div>; })}</div>
      <div className={styles.areaGround} />
      <div className={styles.areaObstacleStrip}>{area.obstaclePalette.map((obstacle) => <span key={obstacle.key}>{obstacle.icon}<small>{obstacle.name}</small></span>)}</div>
      <button className={styles.royalPlayButton} disabled={!hydrated || player.energy < 1} onClick={onPlay}><small>LEVEL</small><b>{player.currentLevel}</b><span>PLAY · 1 ⚡</span></button>
    </section>
    <section className={styles.buildTaskCard}>
      {nextTask ? <><div className={styles.taskIcon}>{nextTask.icon}</div><div className={styles.taskCopy}><small>NEXT AREA TASK · {taskLevel + 1}/{nextTask.maxLevel}</small><b>{taskLevel === 0 ? "Build" : "Upgrade"} {nextTask.name}</b><span>🪙 {formatNumber(taskCoins)} <i>+</i> ★ {taskStars}</span></div><button disabled={!canBuild} onClick={onBuild}>{canBuild ? "BUILD" : player.stars < taskStars ? "NEED STARS" : "NEED COINS"}</button></> : !rewardClaimed ? <><div className={styles.taskIcon}>🎁</div><div className={styles.taskCopy}><small>AREA COMPLETE</small><b>Open the {area.areaCompletionReward.chestType} Chest</b><span>🪙 {formatNumber(area.areaCompletionReward.coins)} · ⚡ {area.areaCompletionReward.energy}</span></div><button onClick={onClaim}>CLAIM</button></> : <><div className={styles.taskIcon}>✅</div><div className={styles.taskCopy}><small>RESTORATION COMPLETE</small><b>{area.displayName} is thriving</b><span>Choose another area from the Kingdom Map</span></div></>}
    </section>
  </div>;
}

function BottomNav({ active, onChange }: { active: HubTab; onChange: (tab: HubTab) => void }) {
  const tabs: Array<{ id: HubTab; icon: string; label: string }> = [{ id: "shop", icon: "🛒", label: "Shop" }, { id: "teams", icon: "🛡", label: "Teams" }, { id: "home", icon: "🏰", label: "Home" }, { id: "events", icon: "🏆", label: "Events" }, { id: "map", icon: "🗺", label: "Kingdom" }];
  return <nav className={styles.bottomNav} aria-label="Main menu">{tabs.map((tab) => <button className={active === tab.id ? styles.activeTab : ""} onClick={() => onChange(tab.id)} key={tab.id}><span>{tab.icon}</span><b>{tab.label}</b>{tab.id === "events" && <i>2</i>}</button>)}</nav>;
}

function PanelHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <header className={styles.panelHeader}><small>{eyebrow}</small><h1>{title}</h1><p>{copy}</p></header>;
}

function ShopPanel({ onAction }: { onAction: () => void }) {
  return <section className={styles.hubPanel}><PanelHeader eyebrow="ROYAL MARKET" title="Shop" copy="Energy, coins, and boosters for the next expedition." /><div className={styles.freeGift}><span>🎁</span><div><small>DAILY GIFT</small><b>King's Supply Box</b><p>Energy · Coins · One random booster</p></div><button onClick={onAction}>PREVIEW</button></div><div className={styles.packGrid}>{[["⚡","Energy Satchel","25 Tickets"],["🪙","Coin Purse","2,500 Coins"],["🔨","Builder Bundle","3 Boosters"],["👑","Royal Chest","Best Value"]].map(([icon,name,copy]) => <article key={name}><span>{icon}</span><b>{name}</b><p>{copy}</p><button onClick={onAction}>VIEW</button></article>)}</div></section>;
}

function TeamsPanel({ onAction }: { onAction: () => void }) {
  return <section className={styles.hubPanel}><PanelHeader eyebrow="SOCIAL KINGDOM" title="Teams" copy="Chat, trade lives, and climb the team league together." /><article className={styles.teamHero}><span>🦁</span><div><small>YOUR TEAM · 42 MEMBERS</small><h2>Royal Wordsmiths</h2><p>Weekly score 18,450 · Gold League</p></div></article><div className={styles.chatPreview}><p><b>Maya</b> Great raid! I have spare lives.</p><p><b>Leo</b> Who found AURORA today?</p><p><b>You</b> Ready for the Star Race 👑</p></div><button className={styles.panelCta} onClick={onAction}>Request Free Energy</button></section>;
}

function EventsPanel({ onAction }: { onAction: () => void }) {
  return <section className={styles.hubPanel}><PanelHeader eyebrow="LIVE NOW" title="Events" copy="Limited-time races and raids with kingdom-sized rewards." /><div className={styles.eventList}><article><span>⚔️</span><div><small>ENDS IN 2H 14M</small><h2>Raid Tournament</h2><p>#12 · 840 points · Gold Chest</p><i><b style={{ width: "68%" }} /></i></div><button onClick={onAction}>GO</button></article><article><span>⭐</span><div><small>ENDS IN 1D 6H</small><h2>Star Race</h2><p>Collect 8 more stars to take the lead</p><i><b style={{ width: "44%" }} /></i></div><button onClick={onAction}>GO</button></article></div></section>;
}

function MapPanel({ player, onSelect }: { player: PlayerState; onSelect: (areaId: number) => void }) {
  return <section className={styles.hubPanel}><PanelHeader eyebrow="THE KING'S JOURNEY" title="Kingdom Map" copy="Every restored area unlocks a new themed dictionary and obstacle set." /><div className={styles.areaMap}>{areas.map((area, index) => { const unlocked = player.unlockedAreaIds.includes(area.areaId); const progress = areaBuiltLevels(player, area); return <button disabled={!unlocked} onClick={() => onSelect(area.areaId)} data-current={player.currentAreaId === area.areaId} key={area.areaId}><i>{index < areas.length - 1 && "•••"}</i><span>{unlocked ? area.icon : "🔒"}</span><div><small>AREA {area.areaId} · {unlocked ? `${progress}/25` : "LOCKED"}</small><b>{area.displayName}</b><p>{area.subtitle}</p></div>{player.currentAreaId === area.areaId && <em>ACTIVE</em>}</button>; })}</div></section>;
}

function SettingsModal({ player, onToggle, onClose }: { player: PlayerState; onToggle: (key: keyof PlayerSettings) => void; onClose: () => void }) {
  return <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Settings"><section className={styles.settingsModal}><button className={styles.modalClose} onClick={onClose} aria-label="Close settings">×</button><span className={styles.modalIcon}>⚙</span><h2>Settings</h2><p>Make the kingdom feel right for you.</p>{([['sfx','Sound Effects','Sword strikes and tile pops'],['bgm','Background Music','Area-specific royal themes'],['haptics','Haptics','Tactile feedback on supported devices']] as Array<[keyof PlayerSettings,string,string]>).map(([key,label,copy]) => <button className={styles.settingRow} onClick={() => onToggle(key)} aria-pressed={player.settings[key]} key={key}><span><b>{label}</b><small>{copy}</small></span><i className={player.settings[key] ? styles.settingOn : ""}>{player.settings[key] ? "ON" : "OFF"}</i></button>)}<div className={styles.accountRow}><span>👑</span><div><b>Guest King</b><small>Progress saved on this device</small></div><button>ACCOUNT</button></div></section></div>;
}

function Result({ label, value }: { label: string; value: string }) { return <div className={styles.result}><span>{label}</span><b>{value}</b></div>; }

function MetaEventOverlay({ event, onChoose }: { event: MetaEvent; onChoose: (index: number) => void }) {
  const options = event.type === "attack" ? ["Gate", "Tower", "Treasury"] : event.type === "raid" ? ["Bronze Vault", "Silver Vault", "Gold Vault"] : ["Forge Shield"];
  return <div className={styles.eventOverlay} role="dialog" aria-modal="true" aria-label={event.title}><section className={styles.eventCard} data-event={event.type}><div className={styles.eventIcon}>{BADGE_UI[event.type].icon}</div><span className={styles.kicker}>Badge set complete</span><h2>{event.title}</h2><p>{event.description}</p><div className={styles.eventChoices}>{options.map((option, index) => <button key={option} onClick={() => onChoose(index)}><span>{event.type === "attack" ? ["🚪", "🗼", "🏦"][index] : event.type === "raid" ? ["📦", "🔒", "💎"][index] : "🛡"}</span><b>{option}</b><small>{event.type === "shield" ? "Store protection" : "Tap to reveal"}</small></button>)}</div></section></div>;
}
