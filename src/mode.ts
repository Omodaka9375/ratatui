// mode.ts — a legible mode: state that cannot hide. Stamps data-mode-<name>
// on <body> and renders a persistent badge.

import { knob } from "./knob.js";
import { bind } from "./bind.js";
import type { Knob } from "./types.js";

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .rui-mode-badge {
      display:none; position: fixed; bottom: 12px; left: 12px; z-index: 9999;
      font: 11px/1 ui-monospace, monospace; letter-spacing: 0.08em;
      padding: 6px 10px; border-radius: 999px;
      background: #111; color: #ffd34d; border: 1px solid #2a2a2a;
      text-transform: uppercase; pointer-events: none;
    }`;
  document.head.appendChild(style);
}

export function mode(name: string, initial: string): Knob<string> {
  injectStyles();
  const m = knob(initial, `mode:${name}`);
  const badge = document.createElement("div");
  badge.className = "rui-mode-badge";
  document.body.appendChild(badge);

  const unsub = bind(m, (v) => v, (v) => {
    document.body.setAttribute(`data-mode-${name}`, v);
    badge.textContent = `${name}: ${v}`;
  }, `mode-ui:${name}`);

  const origDispose = m.dispose;
  m.dispose = () => {
    unsub();
    badge.remove();
    document.body.removeAttribute(`data-mode-${name}`);
    origDispose();
  };

  return m;
}
