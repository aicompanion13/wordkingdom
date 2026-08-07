# In-Place Transmutation Board Generator

This standalone Node tool creates deterministic Living Board plans without
importing or changing the running game. Tiles never move: solving a word flips
each cleared cell to the letter defined by that word's `transmuteMap`.

## Generate levels

From the repository root:

```text
node tools/board-generator/generate.js --config gen_config.json --count 5
```

The config path is resolved from either the current directory or this tool's
directory. Seeds increment from the configured seed.

## Verify a level

```text
node tools/board-generator/generate.js --verify output/level_12345.json
```

## Level model

Each stage contains two non-overlapping active words:

- one `REVEAL_TRIGGER` whose in-place replacements form the next chain word;
- one `STATIC` word whose cells flip to deterministic filler letters.

Exactly one reveal tile comes from the trigger's cleared cells and the remaining
letters are latent on untouched cells. This gives every reveal a visible cause
without moving any tile. A stage's replacement maps cover disjoint cells, so
their effects commute and every solve order reaches the same state.

`obstacles` is a separate array of `{ "cell": [row, col], "type": "ICE" }`
objects. The generator places them on stable coordinates outside planned word
paths. Transmutation changes only `initialGrid` letters and never changes the
obstacle layer.

The verifier checks every non-empty subset of the stage's solves rather than
permuting solve orders. For each post-transmute state it proves that active and
revealed words exist, maps cover only their cleared cells, active words do not
overlap, and replacement maps cannot conflict. Those same states feed the
accidental-word audit.

All random choices, filler letters, placements, obstacles, and retry sub-seeds
derive from the configured seed. Existing output is never overwritten with
different bytes.
