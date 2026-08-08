import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
  localPreviewAuthEnabled,
} from "@/app/chatgpt-auth";
import WordKingdomV3 from "./WordKingdomV3";
import styles from "./V3.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Word Kingdom: Spell & Steal — Conquest & Albums",
  description: "Conquer a living word path, open card packs, and complete royal sticker albums.",
};

export default async function VersionThreePage() {
  const requestHeaders = await headers();
  const isLocalPreview = localPreviewAuthEnabled(requestHeaders);
  const user = await getChatGPTUser();
  if (!user) {
    return (
      <main className={styles.loginShell}>
        <section className={styles.loginCard}>
          <Image
            src="/word-kingdom-mobile-v3.webp"
            alt="The young king holding the Word Kingdom board"
            width={768}
            height={1365}
            priority
          />
          <div>
            <small>25 LIVING BOARDS · 5 KINGDOMS</small>
            <h1>Save your own royal journey</h1>
            <p>Sign in so your levels, stars, coins, cards, and defenses follow your account.</p>
            <a href={chatGPTSignInPath("/v3", requestHeaders)}>{isLocalPreview ? "START LOCAL TEST" : "SIGN IN WITH CHATGPT"}</a>
            <span>{isLocalPreview ? "This local preview uses a private Royal QA test profile." : "Your friends can use their own ChatGPT accounts. Royal QA is enabled for every tester."}</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <WordKingdomV3
      account={{ displayName: user.displayName, email: user.email }}
      signOutUrl={chatGPTSignOutPath("/v3", requestHeaders)}
    />
  );
}
