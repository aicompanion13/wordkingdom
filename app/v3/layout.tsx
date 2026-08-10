import type { ReactNode } from "react";
import { Fredoka } from "next/font/google";
import localFont from "next/font/local";

const gameDisplay = Fredoka({ weight: "variable", variable: "--font-game-display", subsets: ["latin"] });
const gameHeadline = localFont({
  variable: "--font-game-headline",
  src: [
    { path: "./fonts/WordKingdomRoyal-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/WordKingdomRoyal-Bold.woff2", weight: "700", style: "normal" },
  ],
});

export default function V3Layout({ children }: { children: ReactNode }) {
  return <div className={`${gameDisplay.variable} ${gameHeadline.variable}`} style={{ display: "contents" }}>{children}</div>;
}
