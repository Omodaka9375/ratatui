<p align="center">
  <img src="docs/logo.svg" alt="RatatUI" width="120" height="120" />
</p>

<h1 align="center">RatatUI</h1>

<p align="center">
  A CMS layer for any static page and a tiny reactive engine.<br />
  Annotate your HTML, drop in one script tag, and the page edits itself.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ratat-ui"><img src="https://img.shields.io/npm/v/@omodaka/ratat-ui.svg" alt="npm version" /></a>
  <img src="https://img.shields.io/badge/size-12%20KB%20gzip-blue" alt="size" />
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="zero dependencies" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license" /></a>
</p>

<p align="center">
  <strong>36 KB raw · 12 KB gzipped · zero dependencies</strong><br />
  <a href="https://omodaka9375.github.io/ratatui/">Live demo</a> · <a href="./CHANGELOG.md">Changelog</a> · <a href="./CONTRIBUTING.md">Contributing</a>
</p>

---

## What it is

RatatUI wires HTML elements to reactive data. Change the data, the UI updates. Edit the UI, the data updates. It keeps the two in sync automatically.

It's built for one job: **make a static page editable and persistable without a backend, a build step, or a framework.**

Two ways to use it:

- **Zero-JS** — add `data-*` attributes to your HTML, include one `<script>`. A CMS bar appears; click **Edit**, change text/images/theme, click **Publish**. No code written.
- **Full API** — import `knob`, `bind`, `derive`, and build reactive interfaces programmatically.

> [Live demo](https://omodaka9375.github.io/ratatui/) is a self-demonstrating page — every element on it is editable.

---

# For Users

This section is for people who want to add an CMS layer to a page — no framework knowledge required.

## Install

**Option A — npm** (bundlers, Vite, etc.):

```bash
npm install @omodaka/ratat-ui
```

```javascript
import { autocms } from '@omodaka/ratat-ui/auto';
autocms({ gate: 'always' });
```

**Option B — one script tag** (no tooling at all):

```html
<script type="module" src="https://unpkg.com/@omodaka/ratat-ui@0.4.0/dist/ratatui-cms.min.js" data-ratatui-cms data-gate="always"></script>
```

That's it. With the `data-ratatui-cms` attribute present, the CMS boots itself.

## Make anything editable

Add attributes to the HTML you already have:

```html
<body>
  <h1 data-edit="headline">Welcome</h1>
  <p data-edit="description">Edit this text</p>
  <img data-edit-img="hero" src="photo.jpg" />

  <script type="module" src="ratatui-cms.min.js" data-ratatui-cms data-gate="always"></script>
</body>
```

Click **Edit** in the bar at the bottom, change things, click **Publish**. Reload — your changes are still there.

### All the attributes

| Attribute | What it does | Example |
|-----------|--------------|---------|
| `data-edit="name"` | Inline-editable text | `<h1 data-edit="title">Hello</h1>` |
| `data-edit-img="name"` | Editable image — click / paste / drag-&-drop | `<img data-edit-img="hero" src="photo.jpg">` |
| `data-edit-video="name"` | Editable video embed (YouTube/Vimeo auto-convert) | `<div data-edit-video="intro" data-src="…">` |
| `data-edit-input="name"` | Bind an input control | `<input type="range" data-edit-input="hue">` |
| `data-edit-attr="attr:signal"` | Bind any attribute to a signal | `<div data-edit-attr="class:theme">` |
| `data-edit-list="name"` | Editable collection with add/remove | See [Lists](#lists) |
| `data-field="prop"` | A field inside a list item | `<span data-field="title">` |
| `data-css-var="--name"` | Pipe an input's value to a CSS variable | `<input data-edit-input="hue" data-css-var="--hue">` |

### Configure via the script tag

Everything is configured with `data-*` attributes on the script tag itself:

```html
<script type="module" src="ratatui-cms.min.js"
  data-ratatui-cms
  data-gate="always"
  data-adapter="github"
  data-gh-owner="you"
  data-gh-repo="my-site"
  data-gh-path="content/page.json">
</script>
```

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-gate` | `"hash"` | `"always"` shows the CMS bar always; `"hash"` only when the URL contains `#edit` |
| `data-adapter` | `localStorage` | `"github"`, `"cf"`, `"pinata"`, `"rest"`, or omit for localStorage |
| `data-endpoint` | — | Server URL for `rest` and `cf` |
| `data-storage-key` | `"ratatui:autocms"` | localStorage key (default adapter) |

Tokens are **never** configured via HTML attributes — see [Keeping tokens out of your HTML](#keeping-tokens-out-of-your-html).

## The `#edit` gate — your `/admin` URL

With the default `data-gate="hash"`, **visitors see a completely clean page** — no bar, no outlines. The CMS bar only appears when the URL hash contains `edit`:

| URL | What they get |
|-----|---------------|
| `yoursite.com/` | Clean public page — published content, zero CMS UI |
| `yoursite.com/#edit` | Admin view — CMS bar, Edit → change → Publish |

Published content loads for everyone either way; only the editing UI is gated. Elements with `data-edit-input` (e.g. a theme slider) are **dimmed and locked for visitors** — they become live in edit mode, so the admin's choice is the one that gets published and stored.

## Keeping tokens out of your HTML

You cannot embed an access token in the page — RatatUI does not read any token attribute from HTML. The CMS bar collects it on the admin's browser instead:

 1. Visit `yoursite.com/#edit` with a remote adapter configured (GitHub/CF/Pinata/REST).
2. The bar shows an **access-token field**. Paste your token, hit **Save key**.
3. The token is stored in **your browser's localStorage only** — namespaced per site (`<storage-key>:token`) — and is sent solely on load/publish requests to your backend.

Visitors never receive the token (it's not in the markup), and **Publish is guarded** — if no token is set, the bar flashes the key field instead of firing a doomed request. If a page still carries a legacy `data-token`/`data-gh-token` attribute, it is ignored and a console warning is shown.

```html
<!-- No token in the HTML. The bar collects it on the admin's browser. -->
<script type="module" src="ratatui-cms.min.js" data-ratatui-cms
  data-adapter="github" data-gh-owner="you" data-gh-repo="my-site"
  data-gh-path="content/home.json" data-gh-branch="main"></script>
```

## Where do my edits go?

To whichever backend you pick. Five adapters, one interface — the whole config is the script tag.

### localStorage (default)

No config. Data stays in the browser. Great for trying it out.

### GitHub

Commits a JSON file to a repo via the Contents API. Conflicts detected via blob SHA. The token (needs `repo` or `contents:write`) is entered via the CMS bar key field — never in the HTML.

```html
<script type="module" src="ratatui-cms.min.js" data-ratatui-cms
  data-adapter="github" data-gh-owner="you" data-gh-repo="my-site"
  data-gh-path="content/home.json" data-gh-branch="main" data-gate="always"></script>
```

### Cloudflare Workers KV

Points at a Worker that wraps a KV namespace. Conflicts via `X-Version` header.

```html
<script type="module" src="ratatui-cms.min.js" data-ratatui-cms
  data-adapter="cf" data-endpoint="https://cms.you.workers.dev/content"
  data-gate="always"></script>
```

<details>
<summary>Example Worker (~30 lines)</summary>

```javascript
export default {
  async fetch(req, env) {
    const key = new URL(req.url).pathname;
    if (req.method === "GET") {
      const val = await env.CMS.get(key, "json");
      if (!val) return new Response(null, { status: 404 });
      return Response.json(val);
    }
    if (req.method === "PUT") {
      const clientVersion = req.headers.get("X-Version");
      const existing = await env.CMS.get(key, "json");
      if (clientVersion && existing?.version && existing.version !== clientVersion) {
        return Response.json(existing, { status: 409 });
      }
      const snapshot = await req.json();
      const version = String(Date.now());
      await env.CMS.put(key, JSON.stringify({ snapshot, version }));
      return Response.json({ version });
    }
  }
}
```
</details>

### IPFS (Pinata Cloud)

Publishes each snapshot as a public-IPFS upload via the Pinata v3 API. The file **name acts as the mutable pointer** — load lists files by name (newest first) and reads that CID from a gateway. Content-addressed, last-write-wins.

```html
<script type="module" src="ratatui-cms.min.js" data-ratatui-cms
  data-adapter="pinata" data-pinata-name="my-page" data-gate="always"></script>
```

- `data-pinata-name` — logical name for this page's content (the pointer).
- **JWT** — get one at Pinata App → API Keys (needs `files:read` + `files:write`). Don't put it in the HTML — enter it once via the CMS bar's key field; it's stored in your browser only.
- `data-gateway` — optional read gateway (default `https://gateway.pinata.cloud`).

### REST API

Generic JSON API with ETag conflict detection. Works with any backend.

```html
<script type="module" src="ratatui-cms.min.js" data-ratatui-cms
  data-adapter="rest" data-endpoint="https://api.example.com/content/home"
  data-gate="always"></script>
```

Protocol: `GET` returns JSON + `ETag`. `PUT` sends JSON body + `If-Match`. Server returns `409` on conflict.

## Media

### Editable images

In edit mode, users can **click** to enter a URL, **paste** an image (file → data URI) or URL, or **drag & drop** a file onto it.

```html
<img data-edit-img="heroPhoto" src="default.jpg" />
```

### Editable video

Click to enter a URL. YouTube/Vimeo URLs auto-convert to embeds.

```html
<div data-edit-video="introVideo" data-src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></div>
```

Supported: `youtube.com/watch?v=ID`, `youtu.be/ID`, `vimeo.com/ID`, direct `.mp4`/embed URLs.

---

# For Developers

The zero-JS layer is sugar over a small reactive core. Everything the CMS does, you can do by hand.

## The reactive core

### Signals (knobs)

A reactive value that notifies listeners on change. Validation built in.

```javascript
import { knob } from '@omodaka/ratat-ui';

const name = knob('Alice', 'username');
name.get();                  // 'Alice'
name.set('Bob');             // notifies subscribers
name.update(n => n.toUpperCase());

const age = knob(25, { label: 'age', min: 0, max: 150 });
const email = knob('', { pattern: /^.+@.+\..+$/, errorMessage: 'Invalid email' });
```

### Derived values

Lazy computed values — recomputed only when a source changes and the value is read. Tuple-typed.

```javascript
import { derive } from '@omodaka/ratat-ui';

const fullName = derive([firstName, lastName], (f, l) => `${f} ${l}`);
fullName.get();
```

### Bindings

Wire sources to effects. Runs once at creation; skips identical outputs. Heterogeneous source arrays infer each transform argument from its source.

```javascript
import { bind } from '@omodaka/ratat-ui';

bind([name, count], (n, c) => `${n} × ${c}`, text => {
  el.textContent = text;   // n: string, c: number
});
```

`bind` takes an optional 5th argument — a custom equality `(a, b) => boolean` — to skip redundant effect runs.

### Scopes

Group bindings for lifecycle management. One scope per view; wires die with the view.

```javascript
import { scope } from '@omodaka/ratat-ui';

const s = scope('widget');
s.bind(count, v => v, v => el.textContent = v);
s.own(someKnob);   // disposed with the scope
s.dispose();       // cleans up everything
```

## DOM controls

Two-way DOM ↔ signal wiring. **Every control's disposer also removes the event listeners it registered.**

| Function | Description |
|----------|-------------|
| `editable(el, signal, editing?)` | Inline text editing |
| `editableImg(el, signal, editing?)` | Editable image (click/paste/drop) |
| `editableVideo(el, signal, editing?)` | Editable video embed |
| `slider(input, signal)` | Range input |
| `textInput(input, signal)` | Text input |
| `toggle(input, signal)` | Checkbox |
| `colorInput(input, signal)` | Color picker |
| `select(el, signal)` | Select dropdown |
| `textarea(el, signal)` | Textarea |
| `numberInput(input, signal)` | Number input |

## Display

| Function | Description |
|----------|-------------|
| `list(container, signal, render, opts?)` | Keyed list rendering with reconciliation |
| `show(el, signal, predicate?)` | Conditional visibility |
| `swap(container, signal, resolve)` | Swap content dynamically |
| `clone(templateOrSelector)` | Clone a `<template>` element |
| `router(routes, opts?)` | Hash routing with per-route scopes |
| `remote(fetcher, opts?)` | Async data loading with status signals |
| `mode(name, initial)` | Mode signal stamped on `<body>` |

### Lists

```javascript
const items = knob([{ id: 1, text: 'Item 1' }]);

list(container, items, (item, rowScope) => {
  const el = document.createElement('div');
  rowScope.bind(item, t => t.text, text => el.textContent = text);
  return el;
}, { key: t => t.id });
```

## Draft / publish

Wrap signals in a commit boundary for save/discard/conflict workflows. `dirty`, `status`, and `conflict` are themselves signals you can bind to UI.

```javascript
import { draft } from '@omodaka/ratat-ui';

const site = draft({ title, body }, adapter.persist, { version: '1' });

site.dirty.get();    // false
title.set('Changed');
site.dirty.get();    // true

await site.save();   // persists via adapter
site.discard();      // reverts
```

Undo/redo: `draftWithHistory({ ... }, persist)` adds `undo()`, `redo()`, `canUndo()`, `canRedo()`.

## Signal utilities

`debounce`, `throttle`, `distinct`, `map`, `combine`, `formHelper`, `batch`, `flushSync`. All utility signals return a knob whose `dispose()` unsubscribes from the source and clears pending timers — safe to register in a scope.

## Error handling

Route internal errors (bindings, derives, scheduler, `onUpdate` hooks) to your own reporting:

```javascript
import { setErrorHandler } from '@omodaka/ratat-ui';

setErrorHandler((error, { label, phase }) => {
  // phase: 'binding' | 'derive' | 'scheduler' | 'hook'
  reportToMyService({ message: error.message, label, phase });
});
```

Handler errors are swallowed — a broken reporter can never crash your app.

## Teardown

Everything creatable is disposable. `autocms()` returns an `api` whose `dispose()` removes all bindings, listeners, the CMS bar, injected styles, and the mode badge.

```javascript
const api = await autocms({ gate: 'always' });
api.dispose();   // full teardown — safe for SPA unmount / HMR
```

## Programmatic adapters

```javascript
import { githubAdapter } from '@omodaka/ratat-ui';

const adapter = githubAdapter({ owner: 'you', repo: 'site', path: 'content/page.json', token: 'ghp_...', branch: 'main' });
const data = await adapter.load();
await adapter.persist({ title: 'Hello' }, { version: data.version, label: 'page' });
```

## API reference

<details>
<summary><strong>Core</strong></summary>

| Function | Description |
|----------|-------------|
| `knob(initial, options?)` | Create a reactive signal |
| `derive(sources, fn, label?)` | Create a lazy computed value |
| `bind(sources, transform, apply, label?, equality?)` | Wire signals to effects |
| `scope(label?)` | Create a disposal scope |
| `batch(fn)` | Group multiple updates |
| `flushSync()` | Flush pending updates |
</details>

<details>
<summary><strong>CMS &amp; persistence</strong></summary>

| Function | Description |
|----------|-------------|
| `autocms(options?)` | Initialize CMS from HTML attributes |
| `draft(signals, persist, opts?)` | Draft with save/discard |
| `draftWithHistory(signals, persist, opts?)` | Draft with undo/redo |
| `localAdapter(key)` | localStorage persistence |
| `restAdapter(url, opts?)` | REST API with ETag conflicts |
| `githubAdapter(opts)` | GitHub repo persistence |
| `cfAdapter(workerUrl, opts?)` | Cloudflare Workers KV |
| `pinataAdapter(opts)` | IPFS via Pinata Cloud (v3 API) |
| `mountInspector(parent?)` | Live debug panel |
| `setErrorHandler(fn)` | Global error hook |
</details>

**Exported types:** `Knob`, `Derived`, `KnobOptions`, `Binding`, `Source`, `Sources`, `Scope`, `CommitBoundaryApi`, `DraftApi`, `DraftWithHistoryApi`, `ConflictState`, `AutocmsApi`, `Adapter`, `ErrorHandler`, `ErrorContext`, `RegistryEvent`, `EqualityFn`.

## How it works (internals)

- **knob** is the atom — one value, a subscriber set, optional validation + custom equality. `set()` schedules notifications on a deduplicating microtask scheduler.
- **scheduler** solves the diamond problem (a job queued N times in one tick runs once) and detects binding cycles via per-binding recursion-depth tracking.
- **bind** runs its transform at creation ("always ready") and skips when the output is equal to the last run.
- **commit.ts** is the commit boundary — play is free, consequence is explicit. Snapshots are diffed against the last saved state to compute `dirty`.
- **auto.ts** scans the DOM for `data-*` attributes, creates a signal per annotated element, wires the controls, and mounts the CMS bar. `autocms()` returns a root `scope`, so teardown is one call.

## Package layout

| Entry | What | Notes |
|-------|------|-------|
| `@omodaka/ratat-ui` | Core API (`dist/index.js`) | SSR-safe, no DOM at import time |
| `@omodaka/ratat-ui/auto` | Zero-JS layer (`dist/auto.js`) | `autocms()`; guarded self-run |
| `@omodaka/ratat-ui/cms` | CDN bundle (`dist/ratatui-cms.min.js`) | Single file, both tiers |

The package is `sideEffects`-annotated — bundlers tree-shake unused modules from `@omodaka/ratat-ui`.

---

## License

MIT
