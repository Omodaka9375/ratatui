// inspector.ts — the oscilloscope. Draggable, collapsible, position-persistent.

import { registry } from "./registry.js";
import type { RegistryEvent, Knob, Binding } from "./types.js";

const POS_KEY = "ratatui:inspector";

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .rui-i {
      position: fixed; top: 12px; right: 12px; width: 280px; max-height: 86vh;
      display: flex; flex-direction: column; z-index: 9998;
      background: #0d0d11; border: 1px solid #26262e; border-radius: 10px;
      font: 11px/1.5 ui-monospace, monospace; color: #c8c8d4;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    .rui-i header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; font-weight: bold; color: #ffd34d;
      border-bottom: 1px solid #26262e; letter-spacing: 0.06em;
      background: #0d0d11; border-radius: 10px 10px 0 0;
      cursor: grab; user-select: none; touch-action: none;
    }
    .rui-i header.rui-dragging { cursor: grabbing; }
    .rui-i header .rui-title { flex: 1; }
    .rui-i header button {
      background: none; border: 1px solid #26262e; border-radius: 4px;
      color: #6a6a78; font: inherit; cursor: pointer; padding: 1px 7px; line-height: 1.4;
    }
    .rui-i header button:hover { color: #ffd34d; border-color: #ffd34d; }
    .rui-body { overflow-y: auto; flex: 1; }
    .rui-body::-webkit-scrollbar { width: 6px; }
    .rui-body::-webkit-scrollbar-track { background: transparent; }
    .rui-body::-webkit-scrollbar-thumb {
      background: #2a2a36; border-radius: 3px;
    }
    .rui-body::-webkit-scrollbar-thumb:hover { background: #3a3a48; }
    .rui-body { scrollbar-width: thin; scrollbar-color: #2a2a36 transparent; }
    .rui-i.rui-collapsed .rui-body { display: none; }
    .rui-i h4 { margin: 0; padding: 8px 12px 4px; color: #6a6a78;
      text-transform: uppercase; font-size: 9px; letter-spacing: 0.15em; }
    .rui-row { display: flex; justify-content: space-between; gap: 8px;
      padding: 3px 12px; border-left: 2px solid transparent; }
    .rui-label { color: #9a9ab0; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; }
    .rui-val { color: #e8e8f0; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; text-align: right; }
    .rui-flash { animation: rui-flash 400ms ease-out; }
    @keyframes rui-flash {
      0% { border-left-color: #ffd34d; background: rgba(255,211,77,0.12); }
      100% { border-left-color: transparent; background: transparent; }
    }`;
  document.head.appendChild(style);
}

const fmt = (v: unknown): string => {
  let s: string;
  try { s = typeof v === "string" ? `"${v}"` : JSON.stringify(v); }
  catch { s = String(v); }
  if (s == null) s = String(v);
  return s.length > 26 ? s.slice(0, 26) + "…" : s;
};

function flash(el: HTMLElement) {
  el.classList.remove("rui-flash");
  void el.offsetWidth;
  el.classList.add("rui-flash");
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function placeAt(root: HTMLElement, x: number, y: number) {
  const margin = 8;
  const maxX = window.innerWidth - root.offsetWidth - margin;
  const maxY = window.innerHeight - 36;
  root.style.left = clamp(x, margin, Math.max(margin, maxX)) + "px";
  root.style.top = clamp(y, margin, Math.max(margin, maxY)) + "px";
  root.style.right = "auto";
}

function savePos(root: HTMLElement, collapsed: boolean) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify({
      x: parseInt(root.style.left, 10),
      y: parseInt(root.style.top, 10),
      collapsed,
    }));
  } catch { /* ignore */ }
}

function loadPos(): { x: number; y: number; collapsed: boolean } | null {
  try { return JSON.parse(localStorage.getItem(POS_KEY) || "null"); }
  catch { return null; }
}

function makeDraggable(root: HTMLElement, header: HTMLElement, getCollapsed: () => boolean) {
  let startX = 0, startY = 0, originX = 0, originY = 0, dragging = false;

  header.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragging = true;
    header.classList.add("rui-dragging");
    header.setPointerCapture(e.pointerId);
    startX = e.clientX; startY = e.clientY;
    const rect = root.getBoundingClientRect();
    originX = rect.left; originY = rect.top;
  });

  header.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    placeAt(root, originX + (e.clientX - startX), originY + (e.clientY - startY));
  });

  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    header.classList.remove("rui-dragging");
    header.releasePointerCapture?.(e.pointerId);
    savePos(root, getCollapsed());
  };
  header.addEventListener("pointerup", end);
  header.addEventListener("pointercancel", end);

  window.addEventListener("resize", () => {
    if (root.style.left) {
      placeAt(root, parseInt(root.style.left, 10), parseInt(root.style.top, 10));
    }
  });
}

export function mountInspector(parent = document.body): HTMLElement {
  injectStyles();
  const root = document.createElement("div");
  root.className = "rui-i";
  root.innerHTML = `
    <header>
      <span class="rui-title">🐻 RatatUI</span>
      <button class="rui-collapse" title="Collapse">–</button>
      <button class="rui-close" title="Hide">×</button>
    </header>
    <div class="rui-body">
      <h4>Signals</h4><div class="rui-knobs"></div>
      <h4>Bindings</h4><div class="rui-binds"></div>
    </div>`;
  parent.appendChild(root);

  const saved = loadPos();
  let collapsed = !!saved?.collapsed;
  if (saved && Number.isFinite(saved.x)) placeAt(root, saved.x, saved.y);
  root.classList.toggle("rui-collapsed", collapsed);

  const header = root.querySelector("header") as HTMLElement;
  makeDraggable(root, header, () => collapsed);

  root.querySelector(".rui-collapse")?.addEventListener("click", () => {
    collapsed = !collapsed;
    root.classList.toggle("rui-collapsed", collapsed);
    savePos(root, collapsed);
  });
  root.querySelector(".rui-close")?.addEventListener("click", () => {
    root.style.display = "none";
  });
  header.addEventListener("dblclick", (e) => {
    if (!(e.target as HTMLElement).closest("button")) {
      const collapseBtn = root.querySelector(".rui-collapse") as HTMLElement | null;
      collapseBtn?.click();
    }
  });

  const knobsEl = root.querySelector(".rui-knobs") as HTMLElement;
  const bindsEl = root.querySelector(".rui-binds") as HTMLElement;
  const knobRows = new Map<Knob, HTMLElement>();
  const bindRows = new Map<Binding, HTMLElement>();

  const addKnob = (k: Knob) => {
    if (knobRows.has(k)) return;
    const row = document.createElement("div");
    row.className = "rui-row";
    row.innerHTML = `<span class="rui-label">${k.label}</span><span class="rui-val"></span>`;
    row.querySelector(".rui-val")!.textContent = fmt(k.get());
    knobsEl.appendChild(row);
    knobRows.set(k, row);
  };

  const addBind = (b: Binding) => {
    if (bindRows.has(b)) return;
    const row = document.createElement("div");
    row.className = "rui-row";
    const srcLabels = b.sources.map((s) => s.label).join(", ");
    row.innerHTML = `<span class="rui-label" title="[${srcLabels}]">${b.label}</span><span class="rui-val"></span>`;
    bindsEl.appendChild(row);
    bindRows.set(b, row);
  };

  registry.knobs.forEach(addKnob);
  registry.bindings.forEach(addBind);

  registry.onEvent((e: RegistryEvent) => {
    switch (e.type) {
      case "knob:create": addKnob(e.knob); break;
      case "knob:set": {
        const row = knobRows.get(e.knob);
        if (!row) return;
        row.querySelector(".rui-val")!.textContent = fmt(e.value);
        flash(row);
        break;
      }
      case "knob:dispose": {
        knobRows.get(e.knob)?.remove();
        knobRows.delete(e.knob);
        break;
      }
      case "binding:create": addBind(e.binding); break;
      case "binding:run": {
        const row = bindRows.get(e.binding);
        if (!row) return;
        row.querySelector(".rui-val")!.textContent = fmt(e.value);
        flash(row);
        break;
      }
      case "binding:dispose": {
        bindRows.get(e.binding)?.remove();
        bindRows.delete(e.binding);
        break;
      }
    }
  });

  return root;
}
