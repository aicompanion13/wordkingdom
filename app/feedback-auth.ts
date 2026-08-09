import { headers } from "next/headers";
import { getChatGPTUser, localPreviewAuthEnabled, type ChatGPTUser } from "@/app/chatgpt-auth";

// Testers can submit feedback with any signed-in account. Only these emails
// (plus, during local dev, the local QA test profile) can view the inbox.
// Add teammates' emails here or via the FEEDBACK_ADMIN_EMAILS env var
// (comma-separated).
const DEFAULT_ADMIN_EMAILS = ["inspectorkush1@gmail.com"];

function adminAllowlist(): Set<string> {
  const fromEnv = (process.env.FEEDBACK_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ADMIN_EMAILS.map((email) => email.toLowerCase()), ...fromEnv]);
}

export async function requireFeedbackAdmin(): Promise<ChatGPTUser | null> {
  const user = await getChatGPTUser();
  if (!user) return null;

  const requestHeaders = await headers();
  if (localPreviewAuthEnabled(requestHeaders) && user.email.endsWith("@local.wordkingdom.test")) {
    return user;
  }

  return adminAllowlist().has(user.email.toLowerCase()) ? user : null;
}
