function normalizeWord(value) {
  return String(value ?? "").trim().toUpperCase();
}

function variationRoots(value) {
  const word = normalizeWord(value);
  const roots = new Set([word]);
  if (word.endsWith("IES") && word.length > 4) roots.add(`${word.slice(0, -3)}Y`);
  if (word.endsWith("ES") && word.length > 4) roots.add(word.slice(0, -2));
  if (word.endsWith("S") && !word.endsWith("SS") && word.length > 3) roots.add(word.slice(0, -1));
  if (word.endsWith("ING") && word.length > 5) {
    const stem = word.slice(0, -3);
    roots.add(stem);
    roots.add(`${stem}E`);
    if (stem.at(-1) === stem.at(-2)) roots.add(stem.slice(0, -1));
  }
  if (word.endsWith("ED") && word.length > 4) {
    const stem = word.slice(0, -2);
    roots.add(stem);
    roots.add(`${stem}E`);
  }
  return roots;
}

export function areSimpleVariations(leftValue, rightValue) {
  const left = variationRoots(leftValue);
  const right = variationRoots(rightValue);
  return [...left].some((root) => right.has(root));
}

export function objectiveWordsFromGeneratedLevel(level) {
  return level.stages.flatMap((stage) =>
    stage.activeWords.map(({ word }) => normalizeWord(word)),
  );
}

export function validateObjectiveRegistry(registry) {
  const errors = [];
  const maximumLength = registry.rules?.maximumLength ?? 8;
  const minimumLength = registry.rules?.minimumLength ?? 3;
  const seen = [];

  for (const level of registry.levels ?? []) {
    const theme = registry.themes?.[level.themeKey];
    if (!theme) errors.push(`Level ${level.levelNumber} uses undeclared theme ${level.themeKey}.`);
    const local = new Set();
    for (const rawWord of level.words ?? []) {
      const word = normalizeWord(rawWord);
      if (!/^[A-Z]+$/.test(word) || word.length < minimumLength || word.length > maximumLength) {
        errors.push(`Level ${level.levelNumber} objective ${word} violates the ${minimumLength}-${maximumLength} letter rule.`);
      }
      if (local.has(word)) errors.push(`Level ${level.levelNumber} repeats objective ${word}.`);
      local.add(word);
      if (theme && !theme.approvedWords.map(normalizeWord).includes(word)) {
        errors.push(`Level ${level.levelNumber} objective ${word} is unrelated to ${theme.displayName}.`);
      }
      for (const prior of seen) {
        if (prior.word === word) {
          errors.push(`Objective ${word} is already used by Level ${prior.levelNumber}.`);
        } else if (areSimpleVariations(prior.word, word)) {
          errors.push(`Objective ${word} is too similar to ${prior.word} from Level ${prior.levelNumber}.`);
        }
      }
      seen.push({ word, levelNumber: level.levelNumber });
    }
    if (local.size !== 8) errors.push(`Level ${level.levelNumber} must register exactly eight objectives.`);
  }

  if (
    Number.isInteger(registry.expectedObjectiveCount) &&
    seen.length !== registry.expectedObjectiveCount
  ) {
    errors.push(
      `Registry must contain ${registry.expectedObjectiveCount} objectives, found ${seen.length}.`,
    );
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return { objectiveCount: seen.length, uniqueCount: new Set(seen.map(({ word }) => word)).size };
}

export function validateObjectivePlan(registry, { levelNumber, themeKey, words }) {
  validateObjectiveRegistry(registry);
  const registeredLevel = registry.levels.find((level) => level.levelNumber === levelNumber);
  if (!registeredLevel) throw new Error(`Level ${levelNumber} is not declared in the Objective Word registry.`);
  if (registeredLevel.themeKey !== themeKey) {
    throw new Error(`Level ${levelNumber} must use theme ${registeredLevel.themeKey}, not ${themeKey}.`);
  }
  const normalized = words.map(normalizeWord);
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`Level ${levelNumber} contains a repeated Objective Word.`);
  }
  if (normalized.length !== 8) throw new Error(`Level ${levelNumber} must contain exactly eight Objective Words.`);
  if (normalized.some((word, index) => word !== normalizeWord(registeredLevel.words[index]))) {
    throw new Error(`Level ${levelNumber} does not match its registered Objective Word list.`);
  }
  return normalized;
}
