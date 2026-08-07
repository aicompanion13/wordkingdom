"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import areasJson from "@/game/v2/data/areas.json";
import { BoardController } from "@/game/v2/board-controller";
import { DirectorSystem } from "@/game/v2/director-system";
import type { ActiveWord, AreaDefinition, BoardSnapshot, Position, Tile } from "@/game/v2/types";
import scoringConfigJson from "@/game/scoring/data/scoring_config.json";
import scoringLevelsJson from "@/game/scoring/data/scoring_levels.json";
import { RunSummaryController } from "@/game/scoring/run-summary-controller";
import { ScoreManager } from "@/game/scoring/score-manager";
import { TelemetryLogger } from "@/game/scoring/telemetry-logger";
import type { BoardResult, ScoreManagerSnapshot, ScoringBoardDefinition, ScoringConfig, SummaryRevealState } from "@/game/scoring/types";
import styles from "./V4.module.css";

const areas = areasJson as AreaDefinition[];
const levels = scoringLevelsJson as ScoringBoardDefinition[];
const scoringConfig = scoringConfigJson as ScoringConfig;
const BESTS_KEY = "word-kingdom-scoring-bests";
const EMPTY_SCORE: ScoreManagerSnapshot = { score: 0, comboMultiplier: 1, bestCombo: 1, validSelections: 0, invalidSelections: 0, hintsUsed: 0, comboBreaks: 0, longestWord: "", wordsFound: 0, idleRemainingRatio: 1 };
const EMPTY_REVEAL: SummaryRevealState = { displayedScore: 0, starsVisible: 0, statsVisible: false, actionsVisible: false };

type Screen = "intro" | "board" | "summary";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

function samePath(first: string[], second: string[]): boolean {
  return first.length === second.length && (first.every((id, index) => id === second[index]) || first.every((id, index) => id === second[second.length - index - 1]));
}

function playTone(step: number, descending = false): void {
  try {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startFrequency = 330 * 2 ** (step / 12);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(startFrequency, context.currentTime);
    if (descending) oscillator.frequency.exponentialRampToValueAtTime(Math.max(180, startFrequency * 0.72), context.currentTime + 0.22);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.25);
    oscillator.addEventListener("ended", () => void context.close(), { once: true });
  } catch { /* audio feedback is optional */ }
}

export default function ScoringBoardV4() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [levelIndex, setLevelIndex] = useState(0);
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [activeWords, setActiveWords] = useState<ActiveWord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clearingIds, setClearingIds] = useState<string[]>([]);
  const [hintedId, setHintedId] = useState<string | null>(null);
  const [score, setScore] = useState<ScoreManagerSnapshot>(EMPTY_SCORE);
  const [message, setMessage] = useState("Find an active word");
  const [animating, setAnimating] = useState(false);
  const [shake, setShake] = useState(false);
  const [comboFeedback, setComboFeedback] = useState<"up" | "break" | null>(null);
  const [result, setResult] = useState<BoardResult | null>(null);
  const [reveal, setReveal] = useState<SummaryRevealState>(EMPTY_REVEAL);
  const [telemetryCount, setTelemetryCount] = useState(0);

  const boardEngine = useRef<BoardController | null>(null);
  const director = useRef<DirectorSystem | null>(null);
  const scoreManager = useRef<ScoreManager | null>(null);
  const summaryController = useRef(new RunSummaryController());
  const telemetry = useRef<TelemetryLogger | null>(null);
  const selection = useRef<string[]>([]);
  const dragStart = useRef<Position | null>(null);
  const dragging = useRef(false);
  const runLogged = useRef(false);
  const feedbackTimer = useRef<number | null>(null);
  const unsubscribeEvents = useRef<Array<() => void>>([]);

  const currentLevel = levels[levelIndex];
  const area = areas.find((candidate) => candidate.areaId === currentLevel.areaId) ?? areas[0];

  useEffect(() => {
    telemetry.current = new TelemetryLogger(window.localStorage);
    setTelemetryCount(telemetry.current.read().length);
    return () => {
      summaryController.current.cancel();
      unsubscribeEvents.current.forEach((unsubscribe) => unsubscribe());
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    };
  }, []);

  useEffect(() => {
    if (screen !== "board") return;
    const timer = window.setInterval(() => {
      if (!scoreManager.current || animating) return;
      setScore(scoreManager.current.tick(Date.now()));
    }, 100);
    return () => window.clearInterval(timer);
  }, [screen, animating]);

  useEffect(() => {
    if (screen !== "board") return;
    const logAbandonment = () => {
      if (runLogged.current || !scoreManager.current || !telemetry.current) return;
      telemetry.current.append(scoreManager.current.telemetry(currentLevel, Date.now(), true));
      runLogged.current = true;
    };
    window.addEventListener("beforeunload", logAbandonment);
    return () => window.removeEventListener("beforeunload", logAbandonment);
  }, [screen, currentLevel]);

  const setFeedback = (type: "up" | "break", tier: number) => {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    setComboFeedback(type);
    playTone(type === "up" ? tier : 1, type === "break");
    feedbackTimer.current = window.setTimeout(() => setComboFeedback(null), 430);
  };

  const startBoard = (index = levelIndex) => {
    summaryController.current.cancel();
    const nextLevel = levels[index];
    const nextArea = areas.find((candidate) => candidate.areaId === nextLevel.areaId) ?? areas[0];
    const startedAt = Date.now();
    const seed = (startedAt ^ nextLevel.level * 4099) >>> 0;
    const nextBoard = new BoardController(8, seed);
    const nextDirector = new DirectorSystem(nextArea, seed, [], 0, 0);
    const decision = nextDirector.activate(nextBoard, 0, "initial");
    const manager = new ScoreManager(scoringConfig, startedAt);
    unsubscribeEvents.current.forEach((unsubscribe) => unsubscribe());
    unsubscribeEvents.current = [
      manager.on("OnComboIncrement", ({ tier }) => setFeedback("up", tier)),
      manager.on("OnComboBreak", () => setFeedback("break", 0)),
    ];
    manager.activateWords(decision.activeWords.map((word) => word.id), startedAt);
    setLevelIndex(index);
    boardEngine.current = nextBoard;
    director.current = nextDirector;
    scoreManager.current = manager;
    runLogged.current = false;
    selection.current = [];
    setBoard(nextBoard.snapshot());
    setActiveWords(decision.activeWords);
    setSelectedIds([]);
    setClearingIds([]);
    setHintedId(null);
    setScore(manager.snapshot(startedAt));
    setMessage("Choose any active word · score freely");
    setResult(null);
    setReveal(EMPTY_REVEAL);
    setAnimating(false);
    setScreen("board");
  };

  const bestForBoard = (boardId: string): number => {
    try {
      const values = JSON.parse(window.localStorage.getItem(BESTS_KEY) ?? "{}") as Record<string, number>;
      return values[boardId] ?? 0;
    } catch { return 0; }
  };

  const saveBest = (boardId: string, value: number) => {
    try {
      const values = JSON.parse(window.localStorage.getItem(BESTS_KEY) ?? "{}") as Record<string, number>;
      values[boardId] = Math.max(values[boardId] ?? 0, value);
      window.localStorage.setItem(BESTS_KEY, JSON.stringify(values));
    } catch { /* local best is optional */ }
  };

  const finishBoard = () => {
    if (!scoreManager.current || !telemetry.current) return;
    const finalResult = scoreManager.current.finalize(currentLevel, Date.now(), bestForBoard(currentLevel.boardId));
    if (finalResult.newBest) saveBest(currentLevel.boardId, finalResult.finalScore);
    telemetry.current.append(scoreManager.current.telemetry(currentLevel, Date.now(), false));
    setTelemetryCount(telemetry.current.read().length);
    runLogged.current = true;
    setResult(finalResult);
    setReveal(EMPTY_REVEAL);
    let previousStars = 0;
    summaryController.current.start(finalResult, (next) => {
      if (next.starsVisible > previousStars) playTone(7 + next.starsVisible);
      previousStars = next.starsVisible;
      setReveal(next);
    });
    setAnimating(false);
    setScreen("summary");
  };

  const abandonBoard = () => {
    if (!runLogged.current && scoreManager.current && telemetry.current) {
      telemetry.current.append(scoreManager.current.telemetry(currentLevel, Date.now(), true));
      setTelemetryCount(telemetry.current.read().length);
      runLogged.current = true;
    }
    setScreen("intro");
  };

  const solveWord = (word: ActiveWord) => {
    if (animating || !scoreManager.current || !boardEngine.current || !director.current) return;
    setAnimating(true);
    setSelectedIds(word.tileIds);
    setClearingIds(word.tileIds);
    const scored = scoreManager.current.scoreWord(word.id, word.word, Date.now());
    const nextSnapshot = scoreManager.current.snapshot();
    setScore(nextSnapshot);
    setMessage(`+${formatNumber(scored.points)} · ${scored.speedMultiplier.toFixed(2)}× speed · ${scored.comboMultiplier.toFixed(1)}× combo`);
    window.setTimeout(() => {
      if (!boardEngine.current || !director.current || !scoreManager.current) return;
      boardEngine.current.clearPath(word.path);
      director.current.notifyWordCleared(word);
      setClearingIds([]);
      setSelectedIds([]);
      selection.current = [];
      setBoard(boardEngine.current.snapshot());
      if (nextSnapshot.wordsFound >= currentLevel.wordsToComplete) {
        window.setTimeout(finishBoard, 260);
        return;
      }
      const decision = director.current.activate(boardEngine.current, nextSnapshot.wordsFound, "cascade");
      const activatedAt = Date.now();
      scoreManager.current.activateWords(decision.activeWords.map((candidate) => candidate.id), activatedAt);
      setBoard(boardEngine.current.snapshot());
      setActiveWords(decision.activeWords);
      setAnimating(false);
    }, 320);
  };

  const updateSelection = (path: Position[]) => {
    const ids = boardEngine.current?.tileIdsForPath(path).filter(Boolean) ?? [];
    selection.current = ids;
    setSelectedIds(ids);
  };

  const submitSelection = () => {
    if (selection.current.length < 2 || animating) return;
    const match = activeWords.find((word) => samePath(selection.current, word.tileIds));
    if (match) { solveWord(match); return; }
    scoreManager.current?.invalidSelection(Date.now());
    if (scoreManager.current) setScore(scoreManager.current.snapshot());
    setMessage("Not an active word · combo gently reset");
    setShake(true);
    window.setTimeout(() => setShake(false), 380);
    selection.current = [];
    setSelectedIds([]);
  };

  const onPointerDown = (tile: Tile) => {
    if (animating) return;
    dragging.current = true;
    dragStart.current = { row: tile.row, col: tile.col };
    updateSelection([{ row: tile.row, col: tile.col }]);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !dragStart.current || !boardEngine.current) return;
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-v4-tile-id]");
    const tile = board?.tiles.flat().find((candidate) => candidate.id === element?.dataset.v4TileId);
    if (!tile) return;
    const path = boardEngine.current.pathBetween(dragStart.current, tile);
    if (path.length) updateSelection(path);
  };

  const onPointerUp = () => {
    dragging.current = false;
    dragStart.current = null;
    if (selection.current.length > 1) submitSelection();
  };

  const onKeyboardTile = (tile: Tile) => {
    if (animating) return;
    if (selection.current.length === 0 || selection.current.length > 1) { updateSelection([tile]); return; }
    const first = board?.tiles.flat().find((candidate) => candidate.id === selection.current[0]);
    if (!first || !boardEngine.current) return;
    const path = boardEngine.current.pathBetween(first, tile);
    if (path.length > 1) { updateSelection(path); window.setTimeout(submitSelection, 0); }
  };

  const useHint = () => {
    const word = activeWords[0];
    if (!word || animating || !scoreManager.current) return;
    scoreManager.current.useHint(Date.now());
    setScore(scoreManager.current.snapshot());
    setHintedId(word.tileIds[0]);
    setMessage(`${word.word} starts with ${word.word[0]} · hint is always free`);
    window.setTimeout(() => setHintedId(null), 1700);
  };

  const exportTelemetry = () => {
    if (!telemetry.current) return;
    const blob = new Blob([telemetry.current.export()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `word-kingdom-telemetry-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const progress = Math.min(1, score.wordsFound / currentLevel.wordsToComplete);
  const thresholdProgress = Math.min(1, score.score / currentLevel.starThresholds[2]);
  const currentStar = score.score >= currentLevel.starThresholds[2] ? 3 : score.score >= currentLevel.starThresholds[1] ? 2 : score.score >= currentLevel.starThresholds[0] ? 1 : 0;
  const nextThreshold = currentStar < 3 ? currentLevel.starThresholds[currentStar as 0 | 1 | 2] : currentLevel.starThresholds[2];
  const selectedLetters = useMemo(() => selectedIds.map((id) => board?.tiles.flat().find((tile) => tile.id === id)?.letter ?? "").join(""), [board, selectedIds]);

  if (screen === "intro") {
    return <main className={styles.shell}><section className={styles.introCard}><span className={styles.labBadge}>SCORING PLAYTEST · V4</span><h1>Master the Living Board</h1><p>Free, unlimited boards for tuning score, speed, combos, hints, and mastery stars.</p><div className={styles.levelPicker}>{levels.map((level, index) => <button key={level.boardId} className={index === levelIndex ? styles.selectedLevel : ""} onClick={() => setLevelIndex(index)}><span>{level.level}</span><b>{level.title}</b><small>{level.wordsToComplete} words</small></button>)}</div><div className={styles.thresholdPreview}><span>STAR TARGETS</span>{currentLevel.starThresholds.map((threshold, index) => <b key={threshold}>{"★".repeat(index + 1)} {formatNumber(threshold)}</b>)}</div><button className={styles.primaryButton} onClick={() => startBoard(levelIndex)}>PLAY BOARD {currentLevel.level}<small>FREE · UNLIMITED REPLAYS</small></button><button className={styles.exportButton} onClick={exportTelemetry}>Export telemetry · {telemetryCount} records</button></section></main>;
  }

  if (screen === "summary" && result) {
    return <main className={`${styles.shell} ${styles.summaryShell}`}><section className={styles.summaryCard}><span className={styles.labBadge}>BOARD {result.level} COMPLETE</span><h1>{result.title}</h1><div className={styles.finalScore}><small>FINAL SCORE</small><b>{formatNumber(reveal.displayedScore)}</b>{result.newBest && reveal.displayedScore === result.finalScore && <em>NEW BEST</em>}</div><div className={styles.summaryStars}>{[1, 2, 3].map((star) => <span className={star <= reveal.starsVisible ? styles.starVisible : ""} key={star}>★</span>)}</div><div className={`${styles.summaryStats} ${reveal.statsVisible ? styles.statsVisible : ""}`}><Result label="Time" value={`${result.durationSeconds}s`} /><Result label="Longest word" value={result.longestWord || "—"} /><Result label="Best combo" value={`${result.bestCombo.toFixed(1)}×`} /><Result label="Accuracy" value={`${Math.round(result.accuracy * 100)}%`} /><Result label="Hints used" value={String(result.hintsUsed)} /><Result label="Invalid paths" value={String(result.invalidSelections)} /></div><div className={`${styles.summaryActions} ${reveal.actionsVisible ? styles.actionsVisible : ""}`}><button className={styles.primaryButton} onClick={() => startBoard((levelIndex + 1) % levels.length)}>PLAY NEXT BOARD</button><button className={styles.secondaryButton} onClick={() => startBoard(levelIndex)}>REPLAY THIS BOARD</button><button className={styles.textButton} onClick={() => setScreen("intro")}>Board selection</button></div></section></main>;
  }

  return <main className={styles.boardShell} style={{ "--accent": area.accent } as React.CSSProperties}><header className={styles.topHud}><button onClick={abandonBoard} aria-label="Exit and log this board as abandoned">×</button><div className={styles.scoreHud}><small>SCORE</small><b>{formatNumber(score.score)}</b></div><div className={`${styles.comboHud} ${comboFeedback === "up" ? styles.comboUp : ""} ${comboFeedback === "break" ? styles.comboBreak : ""}`}><div><small>COMBO</small><b>{score.comboMultiplier.toFixed(1)}×</b></div><i><em style={{ width: `${score.idleRemainingRatio * 100}%` }} /></i></div><div className={styles.wordProgress}><b>{score.wordsFound}/{currentLevel.wordsToComplete}</b><small>WORDS</small></div></header><section className={styles.levelHeader}><div><small>{area.icon} BOARD {currentLevel.level}</small><h1>{currentLevel.title}</h1></div><div className={styles.liveStars}>{[1, 2, 3].map((star) => <span className={star <= currentStar ? styles.earned : ""} key={star}>★</span>)}<small>{currentStar < 3 ? `${formatNumber(Math.max(0, nextThreshold - score.score))} to next star` : "Mastered"}</small></div></section><div className={styles.masteryTrack}><i style={{ width: `${thresholdProgress * 100}%` }} /></div><section className={styles.activeRail}><header><b>ACTIVE WORDS</b><span>Choose your path</span></header><div>{activeWords.map((word) => <article key={word.id}><b>{word.word}</b><small>{word.word.length} letters · {word.word.length * scoringConfig.basePointsPerLetter} base</small></article>)}</div></section><section className={`${styles.boardCard} ${shake ? styles.shake : ""}`}><div className={styles.boardMessage}>{message}</div>{selectedLetters && <div className={styles.selectionPreview}>{selectedLetters}</div>}<div className={styles.letterGrid} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>{board?.tiles.flat().map((tile) => <button key={tile.id} data-v4-tile-id={tile.id} disabled={animating} className={`${selectedIds.includes(tile.id) ? styles.selectedTile : ""} ${clearingIds.includes(tile.id) ? styles.clearingTile : ""} ${hintedId === tile.id ? styles.hintedTile : ""}`} onPointerDown={() => onPointerDown(tile)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onKeyboardTile(tile); } }}>{tile.letter}</button>)}</div><footer><button onClick={useHint} disabled={animating}>💡 HINT<small>Free · resets combo</small></button><span>Drag letters or tap two endpoints</span></footer></section><section className={styles.runStats}><Result label="Accuracy" value={`${Math.round((score.validSelections / Math.max(1, score.validSelections + score.invalidSelections)) * 100)}%`} /><Result label="Best combo" value={`${score.bestCombo.toFixed(1)}×`} /><Result label="Hints" value={String(score.hintsUsed)} /><Result label="Longest" value={score.longestWord || "—"} /></section><div className={styles.boardCompletionTrack}><i style={{ width: `${progress * 100}%` }} /></div></main>;
}

function Result({ label, value }: { label: string; value: string }) {
  return <div className={styles.result}><span>{label}</span><b>{value}</b></div>;
}
