// build.mjs — produces the npm package and the CDN bundle.
//   dist/*.js + *.d.ts              ← npm package (tsc, per-module ESM)
//   dist/ratatui-cms@<version>.min.js  ← immutable CDN artifact
//   dist/ratatui-cms.min.js            ← "latest" convenience copy
import { build } from "esbuild";
import { readFileSync, copyFileSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { execSync } from "node:child_process";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
const versioned = `dist/ratatui-cms@${pkg.version}.min.js`;

// Clean previous output (removes stale artifacts like dist/src/)
rmSync("dist", { recursive: true, force: true });

// 1. npm package: tsc emits per-module ESM JS + .d.ts
console.log("Compiling TypeScript...");
execSync("npx tsc --project tsconfig.json", { stdio: "inherit" });

// 2. CDN bundle: single-file minified ESM
await build({
  entryPoints: ["src/cdn.ts"],
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2020"],
  banner: { js: `/* RatatUI CMS v${pkg.version} | MIT | github.com/Omodaka9375/ratatui */` },
  outfile: versioned,
});
copyFileSync(versioned, "dist/ratatui-cms.min.js");

const buf = readFileSync(versioned);
console.log(`✔ ${versioned}`);
console.log(`  raw: ${(buf.length / 1024).toFixed(1)} KB · gzip: ${(gzipSync(buf).length / 1024).toFixed(1)} KB`);
