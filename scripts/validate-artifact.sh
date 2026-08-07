#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

worker="${SITES_PROJECT_ROOT}/dist/server/index.js"
hosting="${SITES_PROJECT_ROOT}/dist/.openai/hosting.json"

[[ -f "${worker}" ]] || {
  echo "Missing Sites Worker entry: dist/server/index.js" >&2
  exit 66
}
[[ -f "${hosting}" ]] || {
  echo "Missing packaged Sites manifest: dist/.openai/hosting.json" >&2
  exit 66
}

node --input-type=module - "${worker}" "${hosting}" <<'NODE'
import { readFile } from "node:fs/promises";

const [workerPath, hostingPath] = process.argv.slice(2);
JSON.parse(await readFile(hostingPath, "utf8"));

// The production bundle imports Cloudflare's runtime-only `cloudflare:workers`
// module. Validate its emitted contract statically so a plain Node validation
// process does not attempt to execute a Cloudflare Worker bundle.
const workerSource = await readFile(workerPath, "utf8");
const hasDefaultExport = /export\s*\{\s*[\w$]+\s+as\s+default\s*\}/u.test(workerSource);
const hasFetchHandler = /\basync\s+fetch\s*\(/u.test(workerSource);
if (!hasDefaultExport || !hasFetchHandler) {
  throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
}
NODE

echo "Validated Sites artifact: Worker default.fetch contract and hosting manifest are present."
