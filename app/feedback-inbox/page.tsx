import type { Metadata } from "next";
import { headers } from "next/headers";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { requireFeedbackAdmin } from "@/app/feedback-auth";
import { listFeedback } from "@/app/api/feedback/data";
import styles from "./FeedbackInbox.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Feedback Inbox — Word Kingdom",
};

export default async function FeedbackInboxPage() {
  const requestHeaders = await headers();
  const user = await getChatGPTUser();
  if (!user) {
    return (
      <main className={styles.shell}>
        <div className={styles.header}>
          <h1>Feedback inbox</h1>
          <p>
            <a href={chatGPTSignInPath("/feedback-inbox", requestHeaders)} style={{ color: "#fff0ac" }}>
              Sign in
            </a>{" "}
            to view tester feedback.
          </p>
        </div>
      </main>
    );
  }

  const admin = await requireFeedbackAdmin();
  if (!admin) {
    return (
      <main className={styles.shell}>
        <div className={styles.header}>
          <h1>Feedback inbox</h1>
          <p>{user.email} isn't on the feedback-admin allowlist. Add it in app/feedback-auth.ts.</p>
        </div>
      </main>
    );
  }

  const submissions = await listFeedback();

  return (
    <main className={styles.shell}>
      <div className={styles.header}>
        <h1>Feedback inbox</h1>
        <p>{submissions.length} submission{submissions.length === 1 ? "" : "s"} from testers.</p>
      </div>
      {submissions.length === 0 ? (
        <div className={styles.empty}>No feedback yet. Long-press the board while testing to send some.</div>
      ) : (
        <div className={styles.grid}>
          {submissions.map((item) => (
            <article key={item.id} className={styles.card}>
              <img className={styles.screenshot} src={item.screenshotDataUrl} alt={`Marked-up screenshot from level ${item.level}`} />
              <div className={styles.meta}>
                <div className={styles.metaRow}>
                  <span className={styles.badge}>Level {item.level}</span>
                  <span className={styles.badge}>{item.displayName}</span>
                  <span className={styles.badge}>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <audio className={styles.audio} controls src={item.audioDataUrl} />
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
