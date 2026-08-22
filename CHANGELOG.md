# Changelog

All notable changes to RatatUI. Format follows [Keep a Changelog](https://keepachangelog.com/).

## 0.6.0

### Security
- **`#edit` hash gate tightened** — now uses anchored regex (`/^#edit(\b|$)/`) instead of `.includes("edit")`. Previously URLs like `#credits` or `#editor` would unlock the CMS bar.
- **Video URL passthrough hardened** — `toEmbedUrl()` rejects `data:`, `javascript:`, `blob:`, and `vbscript:` URL schemes with a console warning.
- **Inspector panel** — knob/binding labels rendered via `createElement` + `textContent` instead of `innerHTML` to prevent self-XSS from page-author-controlled labels.
- **HTTPS enforcement** — `restAdapter` and `cfAdapter` now warn when the endpoint uses `http://` (except localhost), since tokens are transmitted in cleartext.
- **localAdapter now warns** when gated only by `#edit` hash — no authentication means anyone who discovers the URL can modify and persist content.
- **GitHub adapter URL encoding** — `owner`, `repo`, `path`, and `branch` are now `encodeURIComponent()`-encoded to prevent path traversal and query injection.
- **Pinata adapter network validation** — `network` value is now validated against an allowlist (`"public"` / `"private"`), defaulting to `"public"`.

### Fixed
- Dependency version ranges now reference real, installable versions from the public npm registry.
- `:scope > template` selector replaced with `children` iteration for broader happy-dom compatibility.

## 0.5.0

### Breaking
- **`data-token` / `data-gh-token` HTML attributes are no longer read.** Tokens can only come from the CMS-bar key field (browser localStorage) or a programmatic `TokenSource` getter passed to `autocms()`. A page that still carries the attribute gets a console warning, and the attribute is ignored. Rationale: a token embedded in markup is readable by anyone via view-source.

## 0.4.0

### Breaking
- **IPFS adapter is now Pinata Cloud (v3 API).** The old generic `pinEndpoint`/`pointerUrl` options are gone. `pinataAdapter({ name, jwt, gateway?, network? })` — the file **name** is the mutable pointer (load lists files by name, newest first, last-write-wins). Script tag: `data-adapter="pinata" data-pinata-name="my-page"` (legacy `data-adapter="ipfs"` still maps to it). `ipfsAdapter` remains as a back-compat alias for `pinataAdapter`.

### Changed
- Package renamed to **`@omodaka/ratat-ui`** (npm rejected `ratat-ui` — too similar to the existing `ratatui` package). Update your imports: `npm i @omodaka/ratat-ui`, `import … from '@omodaka/ratat-ui'`.
- Demo moved to root `index.html` (GitHub Pages).

## 0.3.0 — Unreleased

### Breaking
- **Package now ships compiled ESM from `dist/`** instead of raw TypeScript source. `main`/`exports` point at `dist/index.js` with bundled `.d.ts` per module. If you imported from `ratat-ui/src/...`, import from `ratat-ui` or `ratat-ui/auto` instead.
- Renamed `shallowEqual` → `refEqual` (it was always `Object.is` reference equality).

### Added
- `setErrorHandler(fn)` — global error hook for bindings, derives, scheduler jobs, and `onUpdate` hooks. Reports `{ label, phase }` context; swallows handler errors.
- `autocms()` now returns `api.dispose()` — full teardown: bindings, DOM listeners, CMS bar, injected styles, mode badge, and all scanned signals.
- Typed tuple overloads for `bind()` and `derive()` — heterogeneous source arrays infer correctly (`bind([knobA, knobB], (a, b) => ...)`).
- Exported API types: `Scope`, `CommitBoundaryApi`, `DraftApi`, `DraftWithHistoryApi`, `ConflictState`, `AutocmsApi`, `Source`, `Sources`, `ErrorHandler`, `ErrorContext`.
- `bind()` accepts an optional custom equality as 5th argument.
- happy-dom test suite covering the full DOM layer: controls, list, show, mode, and end-to-end `autocms()` lifecycle.
- CI (check/test/build on push+PR) and publish (npm provenance on GitHub release) workflows.

### Fixed
- `throttle()` crashed on first throttled value (temporal dead zone).
- `restAdapter.load()` threw on 404 instead of returning `null` (broke first-run).
- `derive()` retried a failing transform on every read — now waits for a source change.
- `combine().dispose()` skipped registry cleanup.
- `debounce`/`throttle`/`distinct`/`map` had no `dispose()` — timers and source subscriptions leaked.
- All DOM controls (`slider`, `textInput`, `toggle`, `colorInput`, `select`, `textarea`, `numberInput`, `editable`, `editableImg`, `editableVideo`) now remove their event listeners on dispose.
- `mode().dispose()` removes the badge element and the `data-mode-*` body attribute.
- Scheduler recursion guard was global — one cyclic chain reset depth tracking for all chains. Now tracked per binding.
- `knob` warns on `get`/`set`/`subscribe` after `dispose()` instead of silently succeeding.
- `draftWithHistory()` `pushHistory` built a trimmed array but never wrote it back.
- `deepEqual` now handles circular references safely.
- Build cleans `dist/` first (removes stale artifacts like `dist/src/`).

## 0.2.0
- Initial public release: knobs, derive, bind, scope, list, show/swap/clone, router, remote, commit boundaries with undo/redo, five persistence adapters, inspector, zero-JS CMS layer.
