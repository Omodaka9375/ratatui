// index.ts — RatatUI public API (web vocabulary first; legacy names kept)
export { knob, knob as signal } from "./knob.js";
export { derive, derive as computed } from "./derive.js";
export { deepEqual, refEqual } from "./deep-equality.js";
export { bind } from "./bind.js";
export { debounce, throttle, distinct, map, combine, formHelper } from "./utils.js";
export { draft, draftWithHistory, Conflict, commitBoundary, CommitConflict, // legacy aliases
 } from "./commit.js";
export { scope } from "./scope.js";
export { slider, textInput, toggle, colorInput, editable, select, textarea, numberInput, editableImg, editableVideo } from "./controls.js";
export { mode } from "./mode.js";
export { list } from "./list.js";
export { show, swap, clone } from "./show.js";
export { router } from "./router.js";
export { remote } from "./remote.js";
export { localAdapter, restAdapter, githubAdapter, cfAdapter, pinataAdapter, ipfsAdapter } from "./adapters.js";
export { mountInspector } from "./inspector.js";
export { flushSync, batch, activeBindings } from "./scheduler.js";
export { registry } from "./registry.js";
export { setErrorHandler } from "./errors.js";
