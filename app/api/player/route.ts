import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import defaultPlayerJson from "@/game/v3/data/default-player.json";
import defaultPvpJson from "@/game/v3/data/pvp_state.json";
import { createRestartedProgress } from "@/game/v3/progress-reset";
import type { PvpState } from "@/game/v3/pvp-types";
import type { V3PlayerState } from "@/game/v3/types";

export const dynamic = "force-dynamic";

type PlayerPayload = {
  player: V3PlayerState;
  pvp: PvpState;
};

const CREATE_PROFILES_TABLE = `
  CREATE TABLE IF NOT EXISTS player_profiles (
    email TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    player_state_json TEXT NOT NULL,
    pvp_state_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

async function ensureProfilesTable(): Promise<void> {
  await env.DB.prepare(CREATE_PROFILES_TABLE).run();
}

function freshPayload(): PlayerPayload {
  return {
    player: structuredClone(defaultPlayerJson) as V3PlayerState,
    pvp: structuredClone(defaultPvpJson) as PvpState,
  };
}

function isRestartRequest(value: unknown): value is { action: "restart-progress" } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { action?: unknown }).action === "restart-progress",
  );
}

async function savePayload(
  email: string,
  displayName: string,
  payload: PlayerPayload,
): Promise<number> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO player_profiles
      (email, display_name, player_state_json, pvp_state_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        display_name = excluded.display_name,
        player_state_json = excluded.player_state_json,
        pvp_state_json = excluded.pvp_state_json,
        updated_at = excluded.updated_at`,
  )
    .bind(
      email,
      displayName,
      JSON.stringify(payload.player),
      JSON.stringify(payload.pvp),
      now,
      now,
    )
    .run();
  return now;
}

function isPlayerPayload(value: unknown): value is PlayerPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<PlayerPayload>;
  return (
    payload.player?.version === 4 &&
    Number.isFinite(payload.player.currentLevel) &&
    Array.isArray(payload.player.completedLevels) &&
    typeof payload.pvp?.activeShields === "number" &&
    typeof payload.pvp?.shieldFragments === "number"
  );
}

export async function GET(): Promise<Response> {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  await ensureProfilesTable();
  const row = await env.DB.prepare(
    "SELECT player_state_json, pvp_state_json FROM player_profiles WHERE email = ?",
  )
    .bind(user.email)
    .first<{ player_state_json: string; pvp_state_json: string }>();

  if (row) {
    return Response.json({
      account: { displayName: user.displayName, email: user.email },
      player: JSON.parse(row.player_state_json),
      pvp: JSON.parse(row.pvp_state_json),
    });
  }

  const payload = freshPayload();
  const now = Date.now();
  payload.player.energyUpdatedAt = now;
  await env.DB.prepare(
    `INSERT INTO player_profiles
      (email, display_name, player_state_json, pvp_state_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      user.email,
      user.displayName,
      JSON.stringify(payload.player),
      JSON.stringify(payload.pvp),
      now,
      now,
    )
    .run();

  return Response.json({
    account: { displayName: user.displayName, email: user.email },
    ...payload,
  });
}

export async function PUT(request: Request): Promise<Response> {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json();
  if (!isPlayerPayload(body)) {
    return Response.json({ error: "Invalid player state." }, { status: 400 });
  }

  await ensureProfilesTable();
  const now = await savePayload(user.email, user.displayName, body);

  return Response.json({ saved: true, updatedAt: now });
}

export async function POST(request: Request): Promise<Response> {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json();
  if (!isRestartRequest(body)) {
    return Response.json({ error: "Invalid restart request." }, { status: 400 });
  }

  await ensureProfilesTable();
  const row = await env.DB.prepare(
    "SELECT player_state_json FROM player_profiles WHERE email = ?",
  )
    .bind(user.email)
    .first<{ player_state_json: string }>();

  const defaults = freshPayload();
  let settings = defaults.player.settings;
  if (row) {
    try {
      const stored = JSON.parse(row.player_state_json) as Partial<V3PlayerState>;
      if (stored.settings) settings = { ...settings, ...stored.settings };
    } catch {
      // A malformed legacy save must not prevent a deliberate account reset.
    }
  }

  const payload = createRestartedProgress(
    defaults.player,
    defaults.pvp,
    settings,
  );
  const updatedAt = await savePayload(user.email, user.displayName, payload);

  return Response.json({
    account: { displayName: user.displayName, email: user.email },
    ...payload,
    updatedAt,
  });
}
