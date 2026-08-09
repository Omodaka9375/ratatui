# Contributing

## Setup

```bash
npm install
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run check` | TypeScript type-check (no emit) |
| `npm test` | Vitest suite (node + happy-dom) |
| `npm run build` | Emit `dist/` (npm package + CDN bundle) |
| `npm start` | Serve the repo locally (demo at `/index.html`) |

## Conventions

- Zero runtime dependencies. This is a hard rule.
- Every DOM listener registered must be removed by the returned disposer.
- Everything creatable must be disposable (`knob`, `scope`, `bind`, `list`, `autocms`, …).
- Errors keep their `console.error` output and additionally notify `setErrorHandler` — never swallow silently.
- Tests: pure logic runs in node env; DOM tests use `// @vitest-environment happy-dom`.

## Releasing

1. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
2. Merge to `main` — CI runs check/test/build.
3. Create a GitHub release tagged `v<version>` — the publish workflow runs `npm publish --provenance`.
   Requires the `NPM_TOKEN` repo secret.
