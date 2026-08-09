import { getChatGPTUser } from "@/app/chatgpt-auth";
import { requireFeedbackAdmin } from "@/app/feedback-auth";
import { insertFeedback, listFeedback } from "./data";

export const dynamic = "force-dynamic";

const MAX_FIELD_BYTES = 6 * 1024 * 1024; // generous cap for a short voice memo + a single screen capture

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (blob.size > MAX_FIELD_BYTES) {
    throw new Error("File too large");
  }
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const mime = blob.type || "application/octet-stream";
  return `data:${mime};base64,${base64}`;
}

export async function POST(request: Request): Promise<Response> {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const form = await request.formData();
  const screenshot = form.get("screenshot");
  const audio = form.get("audio");
  const level = Number(form.get("level"));

  if (!(screenshot instanceof Blob) || !(audio instanceof Blob) || !Number.isFinite(level)) {
    return Response.json({ error: "Missing screenshot, audio, or level." }, { status: 400 });
  }

  let screenshotDataUrl: string;
  let audioDataUrl: string;
  try {
    [screenshotDataUrl, audioDataUrl] = await Promise.all([
      blobToDataUrl(screenshot),
      blobToDataUrl(audio),
    ]);
  } catch {
    return Response.json({ error: "Screenshot or audio clip is too large." }, { status: 413 });
  }

  const id = await insertFeedback({
    email: user.email,
    displayName: user.displayName,
    level,
    screenshotDataUrl,
    audioDataUrl,
  });

  return Response.json({ submitted: true, id });
}

export async function GET(): Promise<Response> {
  const admin = await requireFeedbackAdmin();
  if (!admin) return Response.json({ error: "Not authorized." }, { status: 403 });

  return Response.json({ submissions: await listFeedback() });
}
