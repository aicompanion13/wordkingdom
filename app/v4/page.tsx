import type { Metadata } from "next";
import ScoringBoardV4 from "./ScoringBoardV4";

export const metadata: Metadata = {
  title: "Word Kingdom — Scoring Lab",
  description: "Free Living Board scoring, combo, hint, mastery, and telemetry playtest.",
};

export default function ScoringLabPage() {
  return <ScoringBoardV4 />;
}
