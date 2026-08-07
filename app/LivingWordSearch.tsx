"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { LEVELS, getDailyLevel, getLevelConfig } from "../game/config";
import { clearMotion, recoverFromActual, resolveMoveFromActual, scanBoard, startLevel } from "../game/director";
import { directionFrom, lettersFor, selectionPath } from "../game/selection";
import type { Coordinate, Direction, GameRuntime, WordOccurrence } from "../game/types";

type GamePhase = "idle" | "success" | "removing" | "falling" | "complete";
type RunMode = "campaign" | "daily" | "coop";
type Screen = "menu" | "game" | "options" | "coop" | "how";
type ToastTone = "score" | "hint" | "mistake" | "current";
type RunStats = { score: number; combo: number; bestCombo: number; mistakes: number; hintsUsed: number };

const INITIAL_SEED = 20260722;
const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const keyFor = ({ row, col }: Coordinate) => `${row}:${col}`;
const freshStats = (): RunStats => ({ score: 0, combo: 0, bestCombo: 0, mistakes: 0, hintsUsed: 0 });
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function seedFromDate(value: string) {
  return value.split("").reduce((seed, character) => Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261);
}

function rankFor(stats: RunStats, foundCount: number) {
  const attempts = foundCount + stats.mistakes;
  const accuracy = attempts ? foundCount / attempts : 1;
  if (stats.hintsUsed === 0 && accuracy >= .9 && stats.bestCombo >= Math.min(3, foundCount)) return 3;
  if (stats.hintsUsed <= 1 && accuracy >= .72) return 2;
  return 1;
}

function Brand({ onClick }: { onClick: () => void }) {
  return <button className="brand brand-button" onClick={onClick} type="button" aria-label="Word Kingdom: Spell & Steal main menu"><span className="brand-mark"><span>W</span><span>K</span></span><span><b>WORD KINGDOM</b><strong>SPELL &amp; STEAL</strong></span></button>;
}

export default function LivingWordSearch() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<RunMode>("campaign");
  const [levelIndex, setLevelIndex] = useState(0);
  const [seed, setSeed] = useState(INITIAL_SEED);
  const [game, setGame] = useState<GameRuntime>(() => startLevel(INITIAL_SEED, LEVELS[0].id));
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [selection, setSelection] = useState<Coordinate[]>([]);
  const [direction, setDirection] = useState<Direction | null>(null);
  const [selectionArmed, setSelectionArmed] = useState(false);
  const [pointerId, setPointerId] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [animateTiles, setAnimateTiles] = useState(true);
  const [hinted, setHinted] = useState<Coordinate[]>([]);
  const [stats, setStats] = useState<RunStats>(() => freshStats());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [campaignScore, setCampaignScore] = useState(0);
  const [dailyBest, setDailyBest] = useState(0);
  const [feedbackOn, setFeedbackOn] = useState(true);
  const [motionOn, setMotionOn] = useState(true);
  const [developerMode, setDeveloperMode] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [showPaths, setShowPaths] = useState(false);
  const [playerNames, setPlayerNames] = useState<[string, string]>(["Player 1", "Player 2"]);
  const [playerScores, setPlayerScores] = useState<[number, number]>([0, 0]);
  const [activePlayer, setActivePlayer] = useState(0);
  const [toast, setToast] = useState<{ id: number; text: string; tone: ToastTone } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const operationRef = useRef(0);
  const selectionRef = useRef<Coordinate[]>([]);
  const directionRef = useRef<Direction | null>(null);
  const dragMovedRef = useRef(false);
  const lastFoundAtRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const dailyKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dailyLevel = useMemo(() => getDailyLevel(dailyKey), [dailyKey]);
  const level = getLevelConfig(game.levelId);
  const remaining = useMemo(() => game.targets.filter((word) => !game.found.includes(word)), [game]);
  const available = useMemo(() => scanBoard(game.board, remaining, game.levelId), [game.board, game.levelId, remaining]);
  const availableUnique = useMemo(() => [...new Set(available.map((item) => item.word))], [available]);
  const activeWords = useMemo(() => new Set(availableUnique), [availableUnique]);
  const selectionLetters = lettersFor(game.board, selection);
  const selectedKeys = new Set(selection.map(keyFor));
  const hintedKeys = new Set(hinted.map(keyFor));
  const inputLocked = phase !== "idle";
  const accuracy = Math.round((game.found.length / Math.max(1, game.found.length + stats.mistakes)) * 100);
  const rank = rankFor(stats, game.found.length);
  const orderedTargets = useMemo(() => [...game.targets].sort((a, b) => {
    const status = (word: string) => activeWords.has(word) ? 0 : game.found.includes(word) ? 1 : 2;
    return status(a) - status(b) || game.targets.indexOf(a) - game.targets.indexOf(b);
  }), [activeWords, game.found, game.targets]);

  useEffect(() => {
    setFeedbackOn(window.localStorage.getItem("living-word-search-feedback") !== "off");
    setMotionOn(window.localStorage.getItem("living-word-search-motion") !== "off");
    setDeveloperMode(window.localStorage.getItem("living-word-search-developer") === "on");
  }, []);

  useEffect(() => {
    setDailyBest(Number(window.localStorage.getItem(`living-word-search-daily-${dailyKey}`) ?? 0));
  }, [dailyKey]);

  useEffect(() => {
    if (screen !== "game" || phase === "complete") return;
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase, screen, seed]);

  useEffect(() => {
    if (phase !== "complete" || mode !== "daily" || stats.score <= dailyBest) return;
    window.localStorage.setItem(`living-word-search-daily-${dailyKey}`, String(stats.score));
    setDailyBest(stats.score);
  }, [dailyBest, dailyKey, mode, phase, stats.score]);

  function announce(text: string, tone: ToastTone) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), text, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1600);
  }

  function playFeedback(kind: "success" | "mistake" | "hint" | "complete") {
    if (!feedbackOn) return;
    if ("vibrate" in navigator) navigator.vibrate(kind === "complete" ? [35, 45, 70] : kind === "mistake" ? [40, 30, 40] : 35);
    if (!("AudioContext" in window)) return;
    const context = audioRef.current ?? new AudioContext();
    audioRef.current = context;
    if (context.state === "suspended") void context.resume();
    const notes = kind === "complete" ? [392, 523, 659] : kind === "success" ? [440, 659] : kind === "hint" ? [523] : [180, 145];
    notes.forEach((frequency, index) => {
      const start = context.currentTime + index * .09, oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = kind === "mistake" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.055, start + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start); oscillator.stop(start + .18);
    });
  }

  function updateSelection(coordinates: Coordinate[], nextDirection: Direction | null) {
    selectionRef.current = coordinates; directionRef.current = nextDirection;
    setSelection(coordinates); setDirection(nextDirection);
  }

  function clearSelection() {
    updateSelection([], null); setSelectionArmed(false); setPointerId(null);
  }

  function launch(nextMode: RunMode, nextLevelIndex: number, nextSeed: number) {
    operationRef.current += 1;
    const nextLevel = nextMode === "daily" ? dailyLevel : LEVELS[nextLevelIndex];
    setMode(nextMode); setLevelIndex(nextLevelIndex); setSeed(nextSeed);
    setGame(startLevel(nextSeed, nextLevel.id)); setPhase("idle"); setAnimateTiles(true); setHinted([]);
    setStats(freshStats()); setElapsedSeconds(0); setToast(null); setShowPaths(false); clearSelection();
    setPlayerScores([0, 0]); setActivePlayer(0); setScreen("game"); lastFoundAtRef.current = Date.now();
  }

  function startJourney() {
    setCampaignScore(0); launch("campaign", 0, Date.now());
  }

  function startDaily() {
    launch("daily", 0, seedFromDate(dailyKey));
  }

  function startCoop() {
    setCampaignScore(0); launch("coop", 0, Date.now());
  }

  function jumpToWorld(nextLevelIndex: number) {
    setCampaignScore(0); launch("campaign", nextLevelIndex, Date.now() + nextLevelIndex * 104729);
  }

  function goToMenu() {
    operationRef.current += 1; clearSelection(); setPhase("idle"); setToast(null); setScreen("menu");
  }

  function restart() {
    launch(mode, levelIndex, mode === "daily" ? seedFromDate(dailyKey) : Date.now());
  }

  function replayWorld() {
    launch(mode, levelIndex, seed);
  }

  function continueJourney() {
    if (mode === "daily") { replayWorld(); return; }
    const accumulated = campaignScore + stats.score;
    if (levelIndex < LEVELS.length - 1) {
      setCampaignScore(accumulated); launch(mode, levelIndex + 1, seed + 104729); return;
    }
    setCampaignScore(0); launch(mode, 0, Date.now());
  }

  function playerLabel(index: number) {
    return playerNames[index].trim() || `Player ${index + 1}`;
  }

  function tileFromPoint(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-board-tile]");
    if (!element) return null;
    const row = Number(element.dataset.row), col = Number(element.dataset.col);
    return Number.isNaN(row) || Number.isNaN(col) ? null : { row, col };
  }

  function beginSelection(event: ReactPointerEvent<HTMLButtonElement>, coordinate: Coordinate) {
    if (inputLocked) return;
    event.preventDefault(); boardRef.current?.setPointerCapture(event.pointerId); setPointerId(event.pointerId);
    const current = selectionRef.current;
    if (selectionArmed && current.length === 1) {
      if (keyFor(current[0]) === keyFor(coordinate)) { clearSelection(); return; }
      const next = selectionPath(current[0], coordinate, null, level.directions);
      updateSelection(next.coordinates, next.direction); setSelectionArmed(false); dragMovedRef.current = true; return;
    }
    dragMovedRef.current = false; setSelectionArmed(false); updateSelection([coordinate], null);
  }

  function moveSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerId !== event.pointerId || inputLocked || selectionRef.current.length === 0) return;
    event.preventDefault();
    const coordinate = tileFromPoint(event.clientX, event.clientY); if (!coordinate) return;
    const start = selectionRef.current[0], nextDirection = directionRef.current ?? directionFrom(start, coordinate, level.directions);
    if (!nextDirection) return;
    if (keyFor(start) !== keyFor(coordinate)) dragMovedRef.current = true;
    const next = selectionPath(start, coordinate, nextDirection, level.directions); updateSelection(next.coordinates, next.direction);
  }

  function markMistake() {
    playFeedback("mistake");
    announce(mode === "coop" ? `${playerLabel(activePlayer)} passes the turn` : "Path broken · combo reset", "mistake");
    setStats((current) => ({ ...current, combo: 0, mistakes: current.mistakes + 1 }));
    if (mode === "coop") setActivePlayer((current) => current === 0 ? 1 : 0);
    setShake(true); clearSelection(); window.setTimeout(() => setShake(false), 390);
  }

  async function finishSelection(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerId !== event.pointerId) return;
    setPointerId(null);
    if (boardRef.current?.hasPointerCapture(event.pointerId)) boardRef.current.releasePointerCapture(event.pointerId);
    const coordinates = selectionRef.current;
    if (coordinates.length === 1 && !dragMovedRef.current) { setSelectionArmed(true); announce("Start tile marked · choose the end", "current"); return; }
    const word = lettersFor(game.board, coordinates);
    if (coordinates.length > 1 && remaining.includes(word)) { await resolveFoundWord(word, coordinates, game); return; }
    markMistake();
  }

  async function chooseTileByKeyboard(event: ReactKeyboardEvent<HTMLButtonElement>, coordinate: Coordinate) {
    const movement: Record<string, Coordinate> = { ArrowUp: { row: -1, col: 0 }, ArrowDown: { row: 1, col: 0 }, ArrowLeft: { row: 0, col: -1 }, ArrowRight: { row: 0, col: 1 } };
    if (movement[event.key]) {
      event.preventDefault(); const next = { row: coordinate.row + movement[event.key].row, col: coordinate.col + movement[event.key].col };
      boardRef.current?.querySelector<HTMLButtonElement>(`[data-row="${next.row}"][data-col="${next.col}"]`)?.focus(); return;
    }
    if (event.key === "Escape") { event.preventDefault(); clearSelection(); return; }
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const current = selectionRef.current;
    if (!selectionArmed || current.length !== 1) { updateSelection([coordinate], null); setSelectionArmed(true); announce("Start tile marked · use arrows, then Enter", "current"); return; }
    if (keyFor(current[0]) === keyFor(coordinate)) { clearSelection(); return; }
    const next = selectionPath(current[0], coordinate, null, level.directions); updateSelection(next.coordinates, next.direction); setSelectionArmed(false);
    const word = lettersFor(game.board, next.coordinates);
    if (next.coordinates.length > 1 && remaining.includes(word)) { await resolveFoundWord(word, next.coordinates, game); return; }
    markMistake();
  }

  async function resolveFoundWord(word: string, coordinates: Coordinate[], snapshot: GameRuntime) {
    const operation = ++operationRef.current, now = Date.now(), scoringPlayer = activePlayer;
    const secondsSinceLast = lastFoundAtRef.current ? (now - lastFoundAtRef.current) / 1000 : 0;
    const nextCombo = secondsSinceLast <= 15 ? stats.combo + 1 : 1;
    const speedBonus = Math.max(0, 240 - Math.floor(secondsSinceLast * 14));
    const gain = word.length * 100 + speedBonus + Math.max(0, nextCombo - 1) * 125;
    const resolution = resolveMoveFromActual(snapshot, word, coordinates);
    if (resolution.runtime.found.length === snapshot.found.length) { markMistake(); return; }
    lastFoundAtRef.current = now;
    setStats((current) => ({ ...current, score: current.score + gain, combo: nextCombo, bestCombo: Math.max(current.bestCombo, nextCombo) }));
    if (mode === "coop") {
      setPlayerScores((current) => current.map((score, index) => index === scoringPlayer ? score + gain : score) as [number, number]);
      setActivePlayer(scoringPlayer === 0 ? 1 : 0);
    }
    playFeedback("success"); announce(`+${gain} · ${nextCombo}× current`, "score");
    const result = resolution.runtime;
    setHinted([]); setPhase("success"); setGame({ ...snapshot, found: result.found }); await wait(360);
    if (operation !== operationRef.current) return;
    setPhase("removing"); await wait(230);
    if (operation !== operationRef.current) return;
    setAnimateTiles(false); clearSelection(); setGame(result); setPhase("falling");
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => setAnimateTiles(true)));
    await wait(level.animationMs + 130);
    if (operation !== operationRef.current) return;
    setGame((current) => ({ ...current, board: clearMotion(current.board) }));
    if (result.found.length === result.targets.length) {
      await wait(180); setPhase("complete"); playFeedback("complete"); announce("World complete!", "score"); return;
    }
    const nextRemaining = result.targets.filter((target) => !result.found.includes(target));
    const actualPlayable = scanBoard(result.board, nextRemaining, result.levelId);
    if (actualPlayable.length) {
      setPhase("idle"); announce(`New path · ${[...new Set(actualPlayable.map((item) => item.word))].join(" + ")}`, "current"); return;
    }
    const recovered = recoverFromActual(result);
    if (recovered.status === "completed") { setGame(recovered.runtime); setPhase("complete"); playFeedback("complete"); return; }
    setGame(recovered.runtime); setPhase("idle"); announce("The world rebuilt the board", "current");
  }

  async function showHint() {
    if (inputLocked || game.hintsRemaining <= 0) return;
    const operation = ++operationRef.current;
    let current = game;
    const objectives = current.targets.filter((word) => !current.found.includes(word));
    if (objectives.length === 0) { setPhase("complete"); return; }
    let choices = scanBoard(current.board, objectives, current.levelId);
    if (!choices.length) {
      setPhase("falling"); setAnimateTiles(false); const recovery = recoverFromActual(current); current = recovery.runtime; setGame(current);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => setAnimateTiles(true)));
      await wait(level.animationMs + 100);
      if (operation !== operationRef.current) return;
      choices = scanBoard(current.board, current.targets.filter((word) => !current.found.includes(word)), current.levelId); setPhase("idle");
    }
    if (!choices.length) return;
    const choice = choices[Math.floor(Math.random() * choices.length)];
    setGame({ ...current, hintsRemaining: current.hintsRemaining - 1 });
    setStats((value) => ({ ...value, score: Math.max(0, value.score - 150), combo: 0, hintsUsed: value.hintsUsed + 1 }));
    playFeedback("hint"); announce("Hint used · −150 · combo reset", "hint"); setHinted(choice.coordinates);
    window.setTimeout(() => setHinted([]), 1900);
  }

  async function autoFindNext() {
    if (inputLocked) return;
    const choice = available[0];
    if (!choice) { announce("No live path to auto-find", "mistake"); return; }
    await resolveFoundWord(choice.word, choice.coordinates, game);
  }

  function toggleFeedback() {
    const next = !feedbackOn; setFeedbackOn(next); window.localStorage.setItem("living-word-search-feedback", next ? "on" : "off");
  }

  function toggleMotion() {
    const next = !motionOn; setMotionOn(next); window.localStorage.setItem("living-word-search-motion", next ? "on" : "off");
  }

  function toggleDeveloperMode() {
    const next = !developerMode; setDeveloperMode(next); setDebugOpen(false); setShowPaths(false);
    window.localStorage.setItem("living-word-search-developer", next ? "on" : "off");
  }

  if (screen === "menu") {
    return (
      <main className={`menu-shell ${motionOn ? "" : "effects-off"}`}>
        <div className="menu-atmosphere" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <header className="menu-header"><Brand onClick={() => setScreen("menu")} /><span className="local-profile">LOCAL ADVENTURE</span></header>
        <section className="menu-stage">
          <div className="menu-copy"><img className="kingdom-master-art" src="/word-kingdom-master.png" width={1802} height={872} alt="Word Kingdom: Spell & Steal — the young king holds W and K tiles beside an enchanted word board and a coin-filled castle raid" fetchPriority="high" /><h1 className="sr-only">Word Kingdom: Spell &amp; Steal</h1></div>
          <nav className="main-menu" aria-label="Main menu">
            <button className="menu-action primary" onClick={startJourney} type="button"><span className="menu-action-icon">♛</span><span><b>Start Game</b><small>Journey · 5 worlds</small></span><i>→</i></button>
            <button className="menu-action" onClick={startDaily} type="button"><span className="menu-action-icon">★</span><span><b>Daily Challenge</b><small>{dailyLevel.themeLabel} · Best {dailyBest.toLocaleString()}</small></span><i>→</i></button>
            <button className="menu-action" onClick={() => setScreen("coop")} type="button"><span className="menu-action-icon">2P</span><span><b>Co-op Journey</b><small>Two players · One living board</small></span><i>→</i></button>
            <div className="menu-small-actions"><button onClick={() => setScreen("options")} type="button">⚙ Options</button><button onClick={() => setScreen("how")} type="button">? How to Play</button></div>
            {developerMode && <div className="menu-world-jump"><span>DEV MODE · WORLD JUMP</span><div>{LEVELS.map((world, index) => <button className={`theme-${world.theme}`} onClick={() => jumpToWorld(index)} type="button" key={world.id}><i>{world.symbol}</i><b>{world.themeLabel}</b></button>)}</div></div>}
          </nav>
        </section>
        <section className="world-rail" aria-label="Journey worlds">{LEVELS.map((world, index) => <article className={`world-card theme-${world.theme}`} key={world.id}><span>{world.symbol}</span><div><small>WORLD {String(index + 1).padStart(2, "0")}</small><b>{world.title}</b><p>{world.menuBlurb}</p></div></article>)}</section>
        <footer className="menu-footer">A board that remembers every word you find.</footer>
      </main>
    );
  }

  if (screen === "options" || screen === "how" || screen === "coop") {
    return (
      <main className={`menu-shell utility-shell ${motionOn ? "" : "effects-off"}`}>
        <header className="menu-header"><Brand onClick={goToMenu} /><button className="back-button" onClick={goToMenu} type="button">← Main Menu</button></header>
        {screen === "options" && <section className="utility-panel"><p className="eyebrow">OPTIONS</p><h1>Make it yours.</h1><p className="utility-intro">Preferences are saved on this device.</p><div className="option-list"><button className="option-row" onClick={toggleFeedback} type="button"><span><b>Sound & haptics</b><small>Success tones and tactile feedback</small></span><i className={feedbackOn ? "on" : ""}>{feedbackOn ? "ON" : "OFF"}</i></button><button className="option-row" onClick={toggleMotion} type="button"><span><b>Motion effects</b><small>Board falls, glows, and transitions</small></span><i className={motionOn ? "on" : ""}>{motionOn ? "ON" : "OFF"}</i></button><button className="option-row developer-option" onClick={toggleDeveloperMode} type="button"><span><b>Developer mode</b><small>Owner tools for testing boards and progression</small></span><i className={developerMode ? "on" : ""}>{developerMode ? "ON" : "OFF"}</i></button></div><p className="developer-note">Developer mode adds a private test bar inside the puzzle. It stays off for regular players.</p></section>}
        {screen === "how" && <section className="utility-panel how-panel"><p className="eyebrow">HOW TO PLAY</p><h1>Follow the path.</h1><div className="how-grid"><article><span>01</span><b>Choose a live word</b><p>Only words marked LIVE are currently hidden on the board.</p></article><article><span>02</span><b>Connect its letters</b><p>Drag from the first tile to the last, or tap the two end tiles.</p></article><article><span>03</span><b>Watch the world shift</b><p>Found letters fall away. The board forms the next set of words.</p></article><article><span>04</span><b>Build your current</b><p>Find quickly to grow a combo. Hints reveal a path but cost points.</p></article></div></section>}
        {screen === "coop" && <section className="utility-panel coop-panel"><p className="eyebrow">LOCAL CO-OP</p><h1>Share the journey.</h1><p className="utility-intro">Take turns on the same board. Every find adds to the team score; finds and misses pass the turn.</p><div className="player-inputs"><label><span>PLAYER 1</span><input value={playerNames[0]} maxLength={16} onChange={(event) => setPlayerNames([event.target.value, playerNames[1]])} /></label><label><span>PLAYER 2</span><input value={playerNames[1]} maxLength={16} onChange={(event) => setPlayerNames([playerNames[0], event.target.value])} /></label></div><button className="start-coop" onClick={startCoop} type="button">Start Co-op Journey <span>→</span></button></section>}
      </main>
    );
  }

  const modeLabel = mode === "campaign" ? "Journey" : mode === "daily" ? "Daily Challenge" : "Local Co-op";
  const debugHeatMax = Math.max(1, ...game.usage.flat());

  return (
    <main className={`game-shell theme-${level.theme} ${motionOn ? "" : "effects-off"}`}>
      <div className="ambient-bubbles" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <header className="topbar">
        <Brand onClick={goToMenu} />
        <span className="mode-badge">{level.symbol} {modeLabel}</span>
        <div className="topbar-actions"><button className="feedback-button" onClick={toggleFeedback} type="button" aria-label={`Turn feedback ${feedbackOn ? "off" : "on"}`} title={`Feedback ${feedbackOn ? "on" : "off"}`}>{feedbackOn ? "♫" : "♪"}</button><button className="restart-button" onClick={restart} type="button"><span aria-hidden="true">↻</span> Restart</button><button className="menu-icon-button" onClick={goToMenu} type="button" aria-label="Open main menu">☰</button></div>
      </header>
      <section className="intro" id="game">
        <div className="intro-kicker"><p className="eyebrow">{level.eyebrow}{mode !== "daily" ? ` · ${levelIndex + 1} OF ${LEVELS.length}` : ` · ${dailyKey.slice(5).replace("-", ".")}`}</p>{mode !== "daily" && <div className="dive-track" aria-label={`World ${levelIndex + 1} of ${LEVELS.length}`}>{LEVELS.map((item, index) => <i className={index < levelIndex ? "done" : index === levelIndex ? "current" : ""} key={item.id} />)}</div>}</div>
        <div className="title-row"><div><h1>{level.title}</h1><p>{level.objective}</p></div><div className="progress-bubble" aria-label={`${game.found.length} of ${game.targets.length} words found`}><strong>{game.found.length}</strong><span>/ {game.targets.length}</span></div></div>
        <div className="progress-track" aria-hidden="true"><span style={{ width: `${(game.found.length / game.targets.length) * 100}%` }} /></div>
        {mode === "coop" ? <div className="run-stats coop-stats" aria-label="Co-op statistics"><div><span>TEAM SCORE</span><strong>{stats.score.toLocaleString()}</strong></div><div className={activePlayer === 0 ? "active-player" : ""}><span>{playerLabel(0)}</span><strong>{playerScores[0].toLocaleString()}</strong></div><div className={activePlayer === 1 ? "active-player" : ""}><span>{playerLabel(1)}</span><strong>{playerScores[1].toLocaleString()}</strong></div><div><span>TIME</span><strong>{formatTime(elapsedSeconds)}</strong></div></div> : <div className="run-stats" aria-label="Current run statistics"><div><span>SCORE</span><strong>{stats.score.toLocaleString()}</strong></div><div><span>COMBO</span><strong>{stats.combo ? `${stats.combo}×` : "—"}</strong></div><div><span>TIME</span><strong>{formatTime(elapsedSeconds)}</strong></div><div><span>{mode === "daily" ? "DAILY BEST" : "JOURNEY"}</span><strong>{(mode === "daily" ? Math.max(dailyBest, stats.score) : campaignScore + stats.score).toLocaleString()}</strong></div></div>}
        {mode === "coop" && <div className="turn-banner"><span>TURN</span><b>{playerLabel(activePlayer)}</b><i>Find a word to pass play</i></div>}
      </section>
      <div className="play-layout">
        <section className="board-card" aria-label="Letter board">
          <div className="board-tools"><div className={`selection-readout ${selection.length || hinted.length ? "visible" : ""}`} aria-live="polite"><span>{selectionArmed ? "CHOOSE THE END TILE" : selection.length ? selectionLetters : hinted.length ? "HERE'S A WORD" : "DRAG OR TAP TWO TILES"}</span></div><button className="hint-button" type="button" onClick={showHint} disabled={inputLocked || game.hintsRemaining === 0}><span>✦</span> Hint <b>{game.hintsRemaining}</b></button></div>
          <div ref={boardRef} className={`letter-board ${shake ? "board-shake" : ""} phase-${phase}`} onPointerMove={moveSelection} onPointerUp={finishSelection} onPointerCancel={finishSelection} aria-busy={inputLocked}>
            <div className="board-glow" aria-hidden="true" />
            {Array.from({ length: 64 }, (_, index) => <span className="tile-slot" key={`slot-${index}`} />)}
            {showPaths && developerMode && <svg className="selection-line debug-paths" viewBox="0 0 8 8" aria-hidden="true">{available.map((item, index) => <line x1={item.start.col + .5} y1={item.start.row + .5} x2={item.end.col + .5} y2={item.end.row + .5} key={`${item.word}-${index}`} />)}</svg>}
            {selection.length > 1 && <svg className="selection-line" viewBox="0 0 8 8" aria-hidden="true"><line x1={selection[0].col + .5} y1={selection[0].row + .5} x2={selection[selection.length - 1].col + .5} y2={selection[selection.length - 1].row + .5} /></svg>}
            {game.board.flat().map((tile) => {
              if (!tile) return null;
              const selected = selectedKeys.has(keyFor(tile)), isRemoving = selected && (phase === "success" || phase === "removing");
              const shownRow = animateTiles || tile.fromRow === undefined ? tile.row : tile.fromRow;
              return <button className={`letter-tile ${selected ? "selected" : ""} ${hintedKeys.has(keyFor(tile)) ? "hinted" : ""} ${isRemoving ? "completing" : ""}`} data-board-tile data-row={tile.row} data-col={tile.col} key={tile.id} onPointerDown={(event) => beginSelection(event, tile)} onKeyDown={(event) => void chooseTileByKeyboard(event, tile)} disabled={inputLocked} aria-label={`${tile.letter}, row ${tile.row + 1}, column ${tile.col + 1}`} style={{ "--tile-row": shownRow, "--tile-col": tile.col } as CSSProperties}><span>{tile.letter}</span></button>;
            })}
            {toast && <div className={`action-toast ${toast.tone}`} key={toast.id} role="status">{toast.text}</div>}
          </div>
          <p className="board-hint"><span>↗</span> Drag, tap two tiles, or use Enter + arrow keys</p>
        </section>
        <aside className="word-panel">
          <div className="word-panel-heading"><div><p className="eyebrow">IN THIS WORLD</p><h2>{level.wordLabel}</h2></div><span className="live-count">{availableUnique.length} LIVE</span></div>
          <p className="word-contract">Only live words are on the board now. Each find forms the next path.</p>
          <div className="word-list">{orderedTargets.map((word) => {
            const found = game.found.includes(word), active = activeWords.has(word), originalIndex = game.targets.indexOf(word);
            return <div className={`word-item ${found ? "found" : active ? "active" : "locked"}`} key={word}><span className="word-number">{String(originalIndex + 1).padStart(2, "0")}</span><span className="target-word">{found || active ? word : "Waiting beyond"}</span><span className="word-status" aria-label={found ? "found" : active ? "live" : "not yet formed"}>{found ? "✓" : active ? "LIVE" : "≈"}</span></div>;
          })}</div>
          <div className="current-card"><span className="current-pulse" /><div><b>The board is alive</b><p>Find a live word. Its space forms the next ones.</p></div></div>
          {developerMode && <div className="developer-tools"><div><span>DEV MODE</span><b>Owner testing tools</b></div><label className="developer-world-select"><span>JUMP TO WORLD</span><select aria-label="Jump to world" value={mode === "daily" ? "" : levelIndex} onChange={(event) => jumpToWorld(Number(event.target.value))}><option value="" disabled>Choose a world</option>{LEVELS.map((world, index) => <option value={index} key={world.id}>{index + 1}. {world.title} · {world.themeLabel}</option>)}</select></label><div className="developer-buttons"><button onClick={() => void autoFindNext()} disabled={inputLocked} type="button">Auto-find next</button><button onClick={() => setShowPaths((value) => !value)} type="button">{showPaths ? "Hide paths" : "Reveal paths"}</button><button onClick={() => setDebugOpen((value) => !value)} type="button">{debugOpen ? "Hide stats" : "Director stats"}</button><button onClick={restart} type="button">New board</button></div></div>}
        </aside>
      </div>
      {developerMode && debugOpen && <DebugPanel phase={phase} game={game} remaining={remaining} available={available} heatMax={debugHeatMax} />}
      <footer>{level.themeLabel} · {level.directionSummary} · Drag, tap, or keyboard</footer>
      {phase === "complete" && <div className="complete-overlay" role="dialog" aria-modal="true" aria-labelledby="complete-title"><div className="confetti" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div><div className="complete-card"><span className="complete-medal" aria-hidden="true">{level.symbol}</span><p className="eyebrow">{mode === "daily" ? "DAILY CHALLENGE CLEARED" : `${level.eyebrow} COMPLETE`}</p><h2 id="complete-title">{mode !== "daily" && levelIndex === LEVELS.length - 1 ? "Worlds Mastered!" : `${level.title} Complete!`}</h2><div className="rank-stars" aria-label={`${rank} out of 3 stars`}>{[1, 2, 3].map((star) => <span className={star <= rank ? "earned" : ""} key={star}>★</span>)}</div><div className="result-grid"><div><span>SCORE</span><strong>{stats.score.toLocaleString()}</strong></div><div><span>TIME</span><strong>{formatTime(elapsedSeconds)}</strong></div><div><span>ACCURACY</span><strong>{accuracy}%</strong></div><div><span>BEST COMBO</span><strong>{stats.bestCombo}×</strong></div><div><span>HINTS</span><strong>{stats.hintsUsed}</strong></div><div><span>MISTAKES</span><strong>{stats.mistakes}</strong></div></div>{mode !== "daily" && <p className="journey-total">Journey total: {(campaignScore + stats.score).toLocaleString()}</p>}{mode === "coop" && <div className="coop-results"><span>{playerLabel(0)} <b>{playerScores[0].toLocaleString()}</b></span><span>{playerLabel(1)} <b>{playerScores[1].toLocaleString()}</b></span></div>}<div className="complete-actions"><button className="primary-result" onClick={continueJourney} type="button"><span>→</span>{mode === "daily" ? "Replay Daily" : levelIndex < LEVELS.length - 1 ? "Next World" : "New Journey"}</button><button className="secondary-result" onClick={replayWorld} type="button">Replay this board</button><button className="secondary-result" onClick={goToMenu} type="button">Main menu</button></div></div></div>}
    </main>
  );
}

function DebugPanel({ phase, game, remaining, available, heatMax }: { phase: GamePhase; game: GameRuntime; remaining: string[]; available: WordOccurrence[]; heatMax: number }) {
  const unique = [...new Set(available.map((item) => item.word))];
  return <section className="debug-panel" aria-label="Developer director statistics"><div><span>STATE</span><b>{phase.toUpperCase()}</b></div><div><span>SOLVABLE</span><b className={available.length ? "yes" : "no"}>{available.length ? "YES" : "NO"}</b></div><div><span>BOARD REVISION</span><b>{game.boardRevision}</b></div><div><span>AVAILABLE NOW</span><b>{unique.join(", ") || "NONE"}</b></div><div><span>REMAINING</span><b>{remaining.join(", ") || "NONE"}</b></div><div><span>PLANNED / INJECTED</span><b>{game.plannedWords.join(", ") || "NONE"}</b></div><div><span>PREPARED MOVES</span><b>{Object.keys(game.preparedMoves).length}</b></div><div><span>ZONES</span><b>{game.zoneActivity.join(" · ")}</b></div><div><span>RESHUFFLES / REPLANS</span><b>{game.reshuffleCount} / {game.branchReplans}</b></div><div className="debug-occurrences"><span>LIVE COORDINATES</span><code>{available.map((item) => `${item.word} ${item.start.row},${item.start.col}→${item.end.row},${item.end.col} ${item.direction.name}`).join(" | ") || "none"}</code></div><div className="debug-heatmap"><span>DIRECTOR HEATMAP</span><div>{game.usage.flat().map((value, index) => <i style={{ "--heat": value / heatMax } as CSSProperties} key={index}>{value}</i>)}</div></div></section>;
}
