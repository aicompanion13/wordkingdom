import { env } from "cloudflare:workers";

const CREATE_FEEDBACK_TABLE = `
  CREATE TABLE IF NOT EXISTS feedback_submissions (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    level INTEGER NOT NULL,
    screenshot_data_url TEXT NOT NULL,
    audio_data_url TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`;

export async function ensureFeedbackTable(): Promise<void> {
  await env.DB.prepare(CREATE_FEEDBACK_TABLE).run();
}

export type FeedbackSubmission = {
  id: string;
  email: string;
  displayName: string;
  level: number;
  screenshotDataUrl: string;
  audioDataUrl: string;
  createdAt: number;
};

export async function insertFeedback(input: {
  email: string;
  displayName: string;
  level: number;
  screenshotDataUrl: string;
  audioDataUrl: string;
}): Promise<string> {
  await ensureFeedbackTable();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO feedback_submissions
      (id, email, display_name, level, screenshot_data_url, audio_data_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, input.email, input.displayName, input.level, input.screenshotDataUrl, input.audioDataUrl, Date.now())
    .run();
  return id;
}

type FeedbackRow = {
  id: string;
  email: string;
  display_name: string;
  level: number;
  screenshot_data_url: string;
  audio_data_url: string;
  created_at: number;
};

export async function listFeedback(limit = 100): Promise<FeedbackSubmission[]> {
  await ensureFeedbackTable();
  const { results } = await env.DB.prepare(
    "SELECT id, email, display_name, level, screenshot_data_url, audio_data_url, created_at FROM feedback_submissions ORDER BY created_at DESC LIMIT ?",
  )
    .bind(limit)
    .run<FeedbackRow>();

  return (results ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    level: row.level,
    screenshotDataUrl: row.screenshot_data_url,
    audioDataUrl: row.audio_data_url,
    createdAt: row.created_at,
  }));
}
