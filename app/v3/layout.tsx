import type { ReactNode } from "react";
import { Fredoka } from "next/font/google";

const gameDisplay = Fredoka({ weight: "variable", variable: "--font-game-display", subsets: ["latin"] });

export default function V3Layout({ children }: { children: ReactNode }) {
  return <div className={gameDisplay.variable} style={{ display: "contents" }}>{children}</div>;
}
