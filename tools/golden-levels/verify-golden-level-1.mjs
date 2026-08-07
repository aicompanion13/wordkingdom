import { readFile } from "node:fs/promises";
import { verifyGoldenLevel } from "./verifier.mjs";

const level = JSON.parse(await readFile(
  new URL("../../game/v3/data/golden-levels/golden_01.json", import.meta.url),
  "utf8",
));
process.stdout.write(`${JSON.stringify(verifyGoldenLevel(level), null, 2)}\n`);
