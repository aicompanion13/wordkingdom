#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateLevel, validateConfig } from "./generator.js";
import { verifyLevel } from "./verifier.js";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, "..", "..");

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (
      argument === "--config" ||
      argument === "--count" ||
      argument === "--verify"
    ) {
      if (index + 1 >= argv.length) {
        throw new Error(`${argument} requires a value.`);
      }
      options[argument.slice(2)] = argv[index + 1];
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

async function firstExistingPath(candidates, label) {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next deterministic resolution location.
    }
  }
  throw new Error(`${label} was not found. Checked: ${candidates.join(", ")}`);
}

async function resolveInputPath(value, extraCandidates = []) {
  if (path.isAbsolute(value)) {
    return firstExistingPath([value], "Input file");
  }
  return firstExistingPath(
    [
      path.resolve(process.cwd(), value),
      path.resolve(toolDirectory, value),
      ...extraCandidates,
    ],
    "Input file",
  );
}

async function loadJson(filePath) {
  const source = await readFile(filePath, "utf8");
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

async function loadDictionary(config, configPath) {
  const configuredPath = config.dictionaryPath;
  const candidates = path.isAbsolute(configuredPath)
    ? [configuredPath]
    : [
        path.resolve(path.dirname(configPath), configuredPath),
        path.resolve(process.cwd(), configuredPath),
        path.resolve(repositoryRoot, configuredPath),
        path.resolve(toolDirectory, "data", path.basename(configuredPath)),
      ];
  const dictionaryPath = await firstExistingPath(candidates, "Dictionary");
  const source = await readFile(dictionaryPath, "utf8");
  return source
    .split(/\r?\n/)
    .map((word) => word.trim().toUpperCase())
    .filter((word) => /^[A-Z]{4,}$/.test(word));
}

async function writeIfChanged(filePath, serialized) {
  try {
    const existing = await readFile(filePath, "utf8");
    if (existing === serialized) {
      return "unchanged";
    }
    throw new Error(
      `Refusing to overwrite a different existing level: ${filePath}`,
    );
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
  await writeFile(filePath, serialized, "utf8");
  return "written";
}

function printHelp() {
  console.log(
    [
      "In-place transmutation board generator",
      "",
      "Generate:",
      "  node tools/board-generator/generate.js --config gen_config.json --count 5",
      "",
      "Verify:",
      "  node tools/board-generator/generate.js --verify output/level_12345.json",
    ].join("\n"),
  );
}

async function verifyExisting(value) {
  const verifyPath = await resolveInputPath(value, [
    path.resolve(toolDirectory, "output", path.basename(value)),
  ]);
  const level = await loadJson(verifyPath);
  const result = verifyLevel(level);
  console.log(
    `Verified ${verifyPath}: ${result.stagesVerified} stages, ` +
      `${result.postTransmuteStatesVerified} post-transmute states, ` +
      "all replacement maps conflict-free.",
  );
}

async function generate(options) {
  if (!options.config) {
    throw new Error("--config is required when generating levels.");
  }

  const parsedCount = options.count === undefined ? 1 : Number(options.count);
  if (!Number.isInteger(parsedCount) || parsedCount < 1) {
    throw new Error("--count must be a positive integer.");
  }

  const configPath = await resolveInputPath(options.config);
  const rawConfig = await loadJson(configPath);
  const config = validateConfig(rawConfig);
  const dictionary = await loadDictionary(config, configPath);
  const outputDirectory = path.resolve(toolDirectory, "output");
  await mkdir(outputDirectory, { recursive: true });

  for (let index = 0; index < parsedCount; index += 1) {
    const levelSeed = (config.seed + index) >>> 0;
    const { level, serialized } = generateLevel(
      config,
      dictionary,
      levelSeed,
      {
        onRetry: ({ attempt, subSeed, message, context }) => {
          console.error(
            `Retry seed ${levelSeed}, attempt ${attempt + 1}, ` +
              `sub-seed ${subSeed}: ${message}`,
          );
          if (Object.keys(context).length > 0) {
            console.error(`  Context: ${JSON.stringify(context)}`);
          }
        },
      },
    );
    const outputPath = path.join(outputDirectory, `level_${levelSeed}.json`);
    const status = await writeIfChanged(outputPath, serialized);
    console.log(
      `${status === "written" ? "Wrote" : "Confirmed"} ${outputPath} — ` +
        `${level.validation.stagesVerified} stages and ` +
        `${level.validation.postTransmuteStatesVerified} states verified, ` +
        `${level.accidentalWords.length} accidental word(s) logged.`,
    );
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (options.verify) {
    if (options.config || options.count) {
      throw new Error("--verify cannot be combined with --config or --count.");
    }
    await verifyExisting(options.verify);
    return;
  }
  await generate(options);
}

main().catch((error) => {
  console.error(`Board generator failed: ${error.message}`);
  if (error.context && Object.keys(error.context).length > 0) {
    console.error(`Context: ${JSON.stringify(error.context)}`);
  }
  process.exitCode = 1;
});
