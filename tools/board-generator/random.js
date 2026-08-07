const UINT32_RANGE = 0x1_0000_0000;

export function deriveSubSeed(baseSeed, attempt) {
  if (!Number.isInteger(baseSeed) || !Number.isInteger(attempt)) {
    throw new TypeError("Seeds and attempts must be integers.");
  }

  let value = (baseSeed + Math.imul(attempt, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}

export class SeededRandom {
  constructor(seed) {
    if (!Number.isInteger(seed)) {
      throw new TypeError(`Seed must be an integer, received ${seed}.`);
    }

    this.state = seed >>> 0;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  }

  int(maxExclusive) {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError("maxExclusive must be a positive integer.");
    }

    return Math.floor(this.next() * maxExclusive);
  }

  pick(values) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new RangeError("Cannot pick from an empty collection.");
    }

    return values[this.int(values.length)];
  }

  shuffle(values) {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = this.int(index + 1);
      [shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[index],
      ];
    }
    return shuffled;
  }
}

const ENGLISH_LETTER_WEIGHTS = [
  ["E", 12.7],
  ["T", 9.06],
  ["A", 8.17],
  ["O", 7.51],
  ["I", 6.97],
  ["N", 6.75],
  ["S", 6.33],
  ["H", 6.09],
  ["R", 5.99],
  ["D", 4.25],
  ["L", 4.03],
  ["C", 2.78],
  ["U", 2.76],
  ["M", 2.41],
  ["W", 2.36],
  ["F", 2.23],
  ["G", 2.02],
  ["Y", 1.97],
  ["P", 1.93],
  ["B", 1.49],
  ["V", 0.98],
  ["K", 0.77],
  ["J", 0.15],
  ["X", 0.15],
  ["Q", 0.1],
  ["Z", 0.07],
];

const TOTAL_LETTER_WEIGHT = ENGLISH_LETTER_WEIGHTS.reduce(
  (sum, [, weight]) => sum + weight,
  0,
);

export function weightedEnglishLetter(random) {
  let cursor = random.next() * TOTAL_LETTER_WEIGHT;

  for (const [letter, weight] of ENGLISH_LETTER_WEIGHTS) {
    cursor -= weight;
    if (cursor <= 0) {
      return letter;
    }
  }

  return "E";
}
