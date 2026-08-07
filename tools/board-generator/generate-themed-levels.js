#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateLevel } from "./generator.js";
import { verifyLevel } from "./verifier.js";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, "..", "..");
const outputDirectory = path.join(toolDirectory, "output", "themed");
const areasPath = path.join(repositoryRoot, "game", "v2", "data", "areas.json");
const dictionaryPath = path.join(toolDirectory, "data", "wordlist.txt");
const legacyFixtureDirectory = path.join(
  toolDirectory,
  "fixtures",
  "legacy-reverse-v2",
);

const LEVELS_PER_THEME = 5;
const BASE_SEED = 731_000;

function playableWords(area) {
  const words = [...new Set(area.themeDictionary)]
    .map((word) => String(word).trim().toUpperCase())
    .filter((word) => /^[A-Z]{4,8}$/.test(word));
  if (words.length < 10) {
    throw new Error(`${area.themeKey} needs at least 10 words between 4 and 8 letters.`);
  }
  return words;
}

async function main() {
  const areas = JSON.parse(await readFile(areasPath, "utf8"));
  const auditDictionary = (await readFile(dictionaryPath, "utf8"))
    .split(/\r?\n/)
    .map((word) => word.trim().toUpperCase())
    .filter((word) => /^[A-Z]{4,}$/.test(word));

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const catalog = [];
  for (const area of areas.slice(0, 5)) {
    const wordPool = playableWords(area);
    for (let localLevel = 1; localLevel <= LEVELS_PER_THEME; localLevel += 1) {
      const levelNumber = (area.areaId - 1) * LEVELS_PER_THEME + localLevel;
      const seed = BASE_SEED + area.areaId * 100 + localLevel;
      const legacyLevel = JSON.parse(
        await readFile(
          path.join(
            legacyFixtureDirectory,
            `level_${String(levelNumber).padStart(2, "0")}.json`,
          ),
          "utf8",
        ),
      );
      const config = {
        seed,
        gridSize: { rows: 8, cols: 8 },
        wordPool,
        stageCount: 4,
        activeWordsPerStage: { min: 2, max: 3 },
        chainRevealRatio: 0.5,
        stageWordPlan: {
          chainWords: [
            ...legacyLevel.stages.map(
              (stage) =>
                stage.activeWords.find(
                  (entry) => entry.type === "REVEAL_TRIGGER",
                ).word,
            ),
            legacyLevel.completionWords[0].word,
          ],
          staticWords: legacyLevel.stages.map(
            (stage) =>
              stage.activeWords.find((entry) => entry.type === "STATIC").word,
          ),
        },
        obstacleConfig: {
          count: Math.min(4 + localLevel, 8),
          types: area.obstaclePalette.map((obstacle) => obstacle.key),
        },
        dictionaryPath: "tools/board-generator/data/wordlist.txt",
      };
      const { level } = generateLevel(config, auditDictionary, seed);
      const themedLevel = {
        ...level,
        levelNumber,
        localLevel,
        areaId: area.areaId,
        themeKey: area.themeKey,
        themeName: area.displayName,
      };
      const verification = verifyLevel(themedLevel);
      if (
        verification.stagesVerified !== themedLevel.validation.stagesVerified ||
        verification.postTransmuteStatesVerified !==
          themedLevel.validation.postTransmuteStatesVerified ||
        verification.reachableAudit.settledStates !==
          themedLevel.validation.reachableSettledStates ||
        verification.reachableAudit.reachableBranches !==
          themedLevel.validation.reachableBranches
      ) {
        throw new Error(`Verification mismatch for level ${levelNumber}.`);
      }
      const serialized = `${JSON.stringify(themedLevel, null, 2)}\n`;
      await writeFile(
        path.join(outputDirectory, `level_${String(levelNumber).padStart(2, "0")}.json`),
        serialized,
        "utf8",
      );
      catalog.push(themedLevel);
      console.log(
        `Verified level ${String(levelNumber).padStart(2, "0")} · ${area.displayName} · seed ${seed}`,
      );
    }
  }

  await writeFile(
    path.join(outputDirectory, "catalog.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
    "utf8",
  );
  console.log(`Wrote ${catalog.length} verified themed levels.`);
}

main().catch((error) => {
  console.error(`Themed generation failed: ${error.message}`);
  process.exitCode = 1;
});
