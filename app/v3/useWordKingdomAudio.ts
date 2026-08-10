"use client";

import { useCallback, useEffect, useRef } from "react";

export type WordKingdomMusic = "kingdom" | "ocean" | "forest" | "album";

export type WordKingdomSfx =
  | "ui_tap"
  | "ui_popup_open"
  | "ui_popup_close"
  | "selection_cancel"
  | "word_found"
  | "bonus_word"
  | "invalid_word"
  | "board_refill"
  | "hint_reveal"
  | "combo_2"
  | "combo_3"
  | "combo_4_plus"
  | "power_attack"
  | "power_steal"
  | "power_raid"
  | "power_shield"
  | "coin_reward"
  | "pack_open"
  | "sticker_reveal"
  | "album_unlock"
  | "album_complete"
  | "level_complete"
  | "level_retry";

type AudioContextConstructor = typeof AudioContext;
type MusicPlayback = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  track: WordKingdomMusic;
};

const MUSIC_VOLUME = 0.45;
const SFX_VOLUME = 0.8;
const MUSIC_CROSSFADE_SECONDS = 0.35;
const TILE_SELECT_COOLDOWN_MS = 35;

const MUSIC_PATHS: Record<WordKingdomMusic, string> = {
  kingdom: "/audio/music/main_kingdom_theme.mp3",
  ocean: "/audio/music/ocean_gameplay_loop.mp3",
  forest: "/audio/music/forest_gameplay_loop.mp3",
  album: "/audio/music/album_discovery_loop.mp3",
};

const SFX_PATHS: Record<WordKingdomSfx, string> = {
  ui_tap: "/audio/sfx/ui_tap.mp3",
  ui_popup_open: "/audio/sfx/ui_popup_open.mp3",
  ui_popup_close: "/audio/sfx/ui_popup_close.mp3",
  selection_cancel: "/audio/sfx/selection_cancel.mp3",
  word_found: "/audio/sfx/word_found.mp3",
  bonus_word: "/audio/sfx/bonus_word.mp3",
  invalid_word: "/audio/sfx/invalid_word.mp3",
  board_refill: "/audio/sfx/board_refill.mp3",
  hint_reveal: "/audio/sfx/hint_reveal.mp3",
  combo_2: "/audio/sfx/combo_2.mp3",
  combo_3: "/audio/sfx/combo_3.mp3",
  combo_4_plus: "/audio/sfx/combo_4_plus.mp3",
  power_attack: "/audio/sfx/power_attack.mp3",
  power_steal: "/audio/sfx/power_steal.mp3",
  power_raid: "/audio/sfx/power_raid.mp3",
  power_shield: "/audio/sfx/power_shield.mp3",
  coin_reward: "/audio/sfx/coin_reward.mp3",
  pack_open: "/audio/sfx/pack_open.mp3",
  sticker_reveal: "/audio/sfx/sticker_reveal.mp3",
  album_unlock: "/audio/sfx/album_unlock.mp3",
  album_complete: "/audio/sfx/album_complete.mp3",
  level_complete: "/audio/sfx/level_complete.mp3",
  level_retry: "/audio/sfx/level_retry.mp3",
};

const TILE_SELECT_PATHS = [1, 2, 3, 4].map(
  (variant) => `/audio/sfx/tile_select_${variant}.mp3`,
);

const PRELOAD_SFX: WordKingdomSfx[] = [
  "ui_tap",
  "ui_popup_open",
  "ui_popup_close",
  "selection_cancel",
  "word_found",
  "bonus_word",
  "invalid_word",
  "board_refill",
  "hint_reveal",
  "combo_2",
  "combo_3",
  "combo_4_plus",
  "coin_reward",
  "level_complete",
];

export function useWordKingdomAudio({
  sfxEnabled,
  bgmEnabled,
}: {
  sfxEnabled: boolean;
  bgmEnabled: boolean;
}) {
  const contextRef = useRef<AudioContext | null>(null);
  const musicMasterRef = useRef<GainNode | null>(null);
  const sfxMasterRef = useRef<GainNode | null>(null);
  const bufferCacheRef = useRef(new Map<string, Promise<AudioBuffer>>());
  const currentMusicRef = useRef<MusicPlayback | null>(null);
  const desiredMusicRef = useRef<WordKingdomMusic | null>(null);
  const sfxEnabledRef = useRef(sfxEnabled);
  const bgmEnabledRef = useRef(bgmEnabled);
  const lastPlayedRef = useRef(new Map<string, number>());
  const tileVariantRef = useRef(0);
  const musicRequestRef = useRef(0);
  const stopTimersRef = useRef<number[]>([]);

  const ensureContext = useCallback(() => {
    if (contextRef.current) return contextRef.current;
    const AudioContextClass = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!AudioContextClass) return null;
    const context = new AudioContextClass();
    const musicMaster = context.createGain();
    const sfxMaster = context.createGain();
    musicMaster.gain.value = bgmEnabledRef.current ? MUSIC_VOLUME : 0;
    sfxMaster.gain.value = sfxEnabledRef.current ? SFX_VOLUME : 0;
    musicMaster.connect(context.destination);
    sfxMaster.connect(context.destination);
    contextRef.current = context;
    musicMasterRef.current = musicMaster;
    sfxMasterRef.current = sfxMaster;
    return context;
  }, []);

  const loadBuffer = useCallback((path: string) => {
    const cached = bufferCacheRef.current.get(path);
    if (cached) return cached;
    const context = ensureContext();
    if (!context) return Promise.reject(new Error("Web Audio is unavailable"));
    const pending = fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error(`Audio failed to load: ${path}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data));
    bufferCacheRef.current.set(path, pending);
    pending.catch(() => bufferCacheRef.current.delete(path));
    return pending;
  }, [ensureContext]);

  const fadeMusicMaster = useCallback((volume: number, seconds = 0.12) => {
    const context = contextRef.current;
    const musicMaster = musicMasterRef.current;
    if (!context || !musicMaster) return;
    const now = context.currentTime;
    musicMaster.gain.cancelScheduledValues(now);
    musicMaster.gain.setValueAtTime(musicMaster.gain.value, now);
    musicMaster.gain.linearRampToValueAtTime(volume, now + seconds);
  }, []);

  const startDesiredMusic = useCallback(async () => {
    const track = desiredMusicRef.current;
    const context = ensureContext();
    if (!track || !bgmEnabledRef.current || !context || context.state !== "running") return;
    if (currentMusicRef.current?.track === track) {
      fadeMusicMaster(MUSIC_VOLUME);
      return;
    }
    const requestId = ++musicRequestRef.current;
    try {
      const buffer = await loadBuffer(MUSIC_PATHS[track]);
      if (
        requestId !== musicRequestRef.current
        || desiredMusicRef.current !== track
        || !bgmEnabledRef.current
        || context.state !== "running"
      ) return;
      const now = context.currentTime;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(musicMasterRef.current!);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + MUSIC_CROSSFADE_SECONDS);
      source.start(now);

      const previous = currentMusicRef.current;
      currentMusicRef.current = { source, gain, track };
      fadeMusicMaster(MUSIC_VOLUME);
      if (previous) {
        previous.gain.gain.cancelScheduledValues(now);
        previous.gain.gain.setValueAtTime(previous.gain.gain.value, now);
        previous.gain.gain.linearRampToValueAtTime(0, now + MUSIC_CROSSFADE_SECONDS);
        const timer = window.setTimeout(() => {
          try { previous.source.stop(); } catch { /* It may already have ended. */ }
          previous.source.disconnect();
          previous.gain.disconnect();
        }, MUSIC_CROSSFADE_SECONDS * 1000 + 80);
        stopTimersRef.current.push(timer);
      }
    } catch {
      // Missing audio must never interrupt gameplay.
    }
  }, [ensureContext, fadeMusicMaster, loadBuffer]);

  const unlock = useCallback(() => {
    const context = ensureContext();
    if (!context) return;
    void context.resume().then(startDesiredMusic).catch(() => undefined);
  }, [ensureContext, startDesiredMusic]);

  const setMusic = useCallback((track: WordKingdomMusic | null) => {
    desiredMusicRef.current = track;
    ++musicRequestRef.current;
    if (!track) {
      fadeMusicMaster(0, 0.2);
      return;
    }
    void loadBuffer(MUSIC_PATHS[track]).catch(() => undefined);
    void startDesiredMusic();
  }, [fadeMusicMaster, loadBuffer, startDesiredMusic]);

  const playPath = useCallback((path: string, volume = 1) => {
    const context = ensureContext();
    const master = sfxMasterRef.current;
    if (!context || !master || context.state !== "running" || !sfxEnabledRef.current) {
      void loadBuffer(path).catch(() => undefined);
      return;
    }
    void loadBuffer(path).then((buffer) => {
      if (!sfxEnabledRef.current || context.state !== "running") return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = volume;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(master);
      source.addEventListener("ended", () => {
        source.disconnect();
        gain.disconnect();
      }, { once: true });
      source.start();
    }).catch(() => undefined);
  }, [ensureContext, loadBuffer]);

  const duckMusic = useCallback((durationMs = 1100, ratio = 0.38) => {
    if (!bgmEnabledRef.current) return;
    fadeMusicMaster(MUSIC_VOLUME * ratio, 0.08);
    const timer = window.setTimeout(() => {
      if (bgmEnabledRef.current) fadeMusicMaster(MUSIC_VOLUME, 0.24);
    }, durationMs);
    stopTimersRef.current.push(timer);
  }, [fadeMusicMaster]);

  const playSfx = useCallback((
    sound: WordKingdomSfx,
    options: { volume?: number; cooldownMs?: number; duckMs?: number } = {},
  ) => {
    const now = performance.now();
    const cooldownMs = options.cooldownMs ?? (sound === "invalid_word" ? 600 : 0);
    const lastPlayed = lastPlayedRef.current.get(sound) ?? -Infinity;
    if (now - lastPlayed < cooldownMs) return;
    lastPlayedRef.current.set(sound, now);
    if (options.duckMs) duckMusic(options.duckMs);
    playPath(SFX_PATHS[sound], options.volume);
  }, [duckMusic, playPath]);

  const playTileSelect = useCallback(() => {
    const now = performance.now();
    const lastPlayed = lastPlayedRef.current.get("tile_select") ?? -Infinity;
    if (now - lastPlayed < TILE_SELECT_COOLDOWN_MS) return;
    lastPlayedRef.current.set("tile_select", now);
    const path = TILE_SELECT_PATHS[tileVariantRef.current % TILE_SELECT_PATHS.length];
    tileVariantRef.current += 1;
    playPath(path, 0.72);
  }, [playPath]);

  useEffect(() => {
    sfxEnabledRef.current = sfxEnabled;
    const context = ensureContext();
    const master = sfxMasterRef.current;
    if (!context || !master) return;
    master.gain.setTargetAtTime(sfxEnabled ? SFX_VOLUME : 0, context.currentTime, 0.03);
  }, [ensureContext, sfxEnabled]);

  useEffect(() => {
    bgmEnabledRef.current = bgmEnabled;
    const context = ensureContext();
    if (!context) return;
    if (bgmEnabled) {
      fadeMusicMaster(MUSIC_VOLUME);
      void startDesiredMusic();
    } else {
      ++musicRequestRef.current;
      fadeMusicMaster(0, 0.12);
    }
  }, [bgmEnabled, ensureContext, fadeMusicMaster, startDesiredMusic]);

  useEffect(() => {
    const context = ensureContext();
    if (context) {
      [...TILE_SELECT_PATHS, ...PRELOAD_SFX.map((sound) => SFX_PATHS[sound])]
        .forEach((path) => void loadBuffer(path).catch(() => undefined));
    }
    const onUnlock = () => unlock();
    window.addEventListener("pointerdown", onUnlock, { capture: true });
    window.addEventListener("keydown", onUnlock, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onUnlock, { capture: true });
      window.removeEventListener("keydown", onUnlock, { capture: true });
      stopTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      stopTimersRef.current = [];
      ++musicRequestRef.current;
      const current = currentMusicRef.current;
      if (current) {
        try { current.source.stop(); } catch { /* It may already have ended. */ }
      }
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, [ensureContext, loadBuffer, unlock]);

  return { playSfx, playTileSelect, setMusic, unlock };
}
