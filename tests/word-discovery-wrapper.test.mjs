import { build } from "../node_modules/.pnpm/node_modules/esbuild/lib/main.js";
import { fileURLToPath } from "node:url";

const result = await build({
  entryPoints: [fileURLToPath(new URL("./word-discovery.test.mjs", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  write: false,
  logLevel: "silent",
});

const bundledSource = result.outputFiles[0].text;
await import(`data:text/javascript;base64,${Buffer.from(bundledSource).toString("base64")}`);
