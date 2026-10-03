import { access, copyFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const photonWasmCandidates = [
  "node_modules/@silvia-odwyer/photon-node/photon_rs_bg.wasm",
  "node_modules/@earendil-works/pi-coding-agent/node_modules/@silvia-odwyer/photon-node/photon_rs_bg.wasm",
];

const deduplicateDependencies = {
  name: "deduplicate-dependencies",
  setup(context) {
    context.onResolve(
      {
        filter: /^(?:@earendil-works\/pi-agent-core|@earendil-works\/pi-ai|@earendil-works\/pi-tui|jiti)(?:\/.*)?$/,
      },
      ({ path }) => ({ path: fileURLToPath(import.meta.resolve(path)) }),
    );
  },
};

const nodeBundleSourcePatches = {
  name: "node-bundle-source-patches",
  setup(context) {
    context.onLoad(
      { filter: /@earendil-works\/pi-coding-agent\/dist\/core\/extensions\/loader\.js$/ },
      async ({ path }) => {
        const source = await readFile(path, "utf8");
        const original = "const usesEmbeddedModules = isBunBinary || isNodeSeaBinary || isBundledNode;";
        const replacement = "const usesEmbeddedModules = true;";
        if (!source.includes(original)) {
          throw new Error("Pi extension loader structure changed; update the Node bundle patch.");
        }
        return {
          contents: source.replace(original, replacement),
          loader: "js",
        };
      },
    );
    context.onLoad(
      { filter: /@earendil-works\/pi-ai\/dist\/api\/openai-completions\.js$/ },
      async ({ path }) => {
        const source = await readFile(path, "utf8");
        const original = "reasoning: rawUsage.completion_tokens_details?.reasoning_tokens || 0,";
        const replacement =
          "reasoning: rawUsage.completion_tokens_details?.reasoning_tokens ?? rawUsage.reasoning_tokens,";
        if (!source.includes(original)) {
          throw new Error("Pi OpenAI completion usage structure changed; update the reasoning token patch.");
        }
        return {
          contents: source.replace(original, replacement),
          loader: "js",
        };
      },
    );
  },
};

const commonOptions = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22.19",
  minify: true,
  legalComments: "none",
  banner: {
    js: "import { createRequire as __aetherCreateRequire } from 'node:module';import { dirname as __aetherDirname } from 'node:path';import { fileURLToPath as __aetherFileURLToPath } from 'node:url';const require = __aetherCreateRequire(import.meta.url);const __dirname = __aetherDirname(__aetherFileURLToPath(import.meta.url));",
  },
};

await Promise.all([
  build({
    ...commonOptions,
    entryPoints: ["src/bridge.ts"],
    outfile: "dist/bridge.mjs",
    plugins: [deduplicateDependencies, nodeBundleSourcePatches],
  }),
  build({
    ...commonOptions,
    entryPoints: ["src/extension-bridge.ts"],
    outfile: "dist/extension-bridge.mjs",
  }),
  build({
    ...commonOptions,
    entryPoints: ["node_modules/@earendil-works/pi-coding-agent/dist/utils/image-resize-worker.js"],
    outfile: "dist/image-resize-worker.js",
  }),
]);

let photonWasmSource;
for (const candidate of photonWasmCandidates) {
  try {
    await access(candidate);
    photonWasmSource = candidate;
    break;
  } catch {
    // Try the alternate npm layout when Photon is hoisted or nested.
  }
}
if (!photonWasmSource) {
  throw new Error("Unable to locate photon_rs_bg.wasm in the installed Pi dependencies.");
}
await copyFile(photonWasmSource, "dist/photon_rs_bg.wasm");
