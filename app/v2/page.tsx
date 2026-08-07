import type { Metadata } from "next";
import WordKingdomV2 from "./WordKingdomV2";

export const metadata: Metadata = {
  title: "Word Kingdom: Spell & Steal — Living Kingdom Prototype",
  description: "Play the new Living Board and rebuild a kingdom with every word.",
};

export default function VersionTwoPage() {
  return <WordKingdomV2 />;
}
