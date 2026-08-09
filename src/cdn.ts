// cdn.ts — single-file bundle entry. One URL, both tiers:
//   Tier 0: <script type="module" src=".../ratatui-cms@x.y.z.min.js" data-ratatui-cms>
//   Tier 2: import { autocms, signal, computed, ... } from ".../ratatui-cms@x.y.z.min.js"
// auto.js self-runs only when a [data-ratatui-cms] script tag is present,
// so importing this file does NOT start the CMS unless you ask it to.

export * from "./index.js";
export { autocms } from "./auto.js";
