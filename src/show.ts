// show.ts — conditionals, HTML-first. show() toggles an existing element.
// swap() replaces a container's content from <template> tags.
// clone() is the template helper.

import { bind } from "./bind.js";
import { scope as makeScope } from "./scope.js";
import type { Knob } from "./types.js";

let autoId = 0;

export function show(
  el: HTMLElement,
  source: Knob<any>,
  predicate: (v: any) => boolean = Boolean,
  label = `show#${++autoId}`
): () => void {
  return bind([source], (v) => !!predicate(v), (visible) => { el.hidden = !visible; }, label);
}

export function clone(templateOrSelector: string | HTMLTemplateElement): Element {
  const tpl = typeof templateOrSelector === "string"
    ? document.querySelector(templateOrSelector) as HTMLTemplateElement
    : templateOrSelector;
  if (!tpl || !tpl.content) throw new Error(`[RatatUI] clone(): no <template> for ${templateOrSelector}`);
  return tpl.content.firstElementChild!.cloneNode(true) as Element;
}

export function swap<T>(
  container: HTMLElement,
  source: Knob<T>,
  resolve: (value: T, scope: ReturnType<typeof makeScope>) => Element | null,
  label = `swap#${++autoId}`
): () => void {
  let cur: { el: Element; scope: ReturnType<typeof makeScope> } | null = null;

  const disposeBind = bind([source], (v) => v, (v) => {
    if (cur) { cur.scope.dispose(); cur.el.remove(); cur = null; }
    const s = makeScope(`${label}:${String(v)}`);
    const el = resolve(v, s);
    if (el) { container.appendChild(el); cur = { el, scope: s }; }
    else s.dispose();
  }, label);

  return () => {
    disposeBind();
    if (cur) { cur.scope.dispose(); cur.el.remove(); cur = null; }
  };
}
