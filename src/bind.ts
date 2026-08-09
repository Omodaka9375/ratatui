// bind.ts — the wire. [Source(s)] → [Transform] → [one Target].
// Runs at creation ("Always Ready"); skips identical outputs.
// Cycle detection: passes binding reference to scheduler.

import { registry } from './registry.js';
import { schedule } from './scheduler.js';
import { reportError } from './errors.js';
import type { Knob, Derived, Binding, RegistryEvent, Source, Sources } from './types.js';

let autoId = 0;

export function bind<T, U>(
  source: Source<T>,
  transform: (value: T) => U,
  apply: (value: U) => void,
  label?: string,
  equality?: (a: U, b: U) => boolean
): () => void;
export function bind<T extends readonly unknown[], U>(
  sources: Sources<T>,
  transform: (...args: T) => U,
  apply: (value: U) => void,
  label?: string,
  equality?: (a: U, b: U) => boolean
): () => void;
export function bind(
  sources: Source<any> | Source<any>[],
  transform: (...args: any[]) => any,
  apply: (value: any) => void,
  label: string = `bind#${++autoId}`,
  equality: (a: any, b: any) => boolean = Object.is
): () => void {
  const srcs: Source<any>[] = Array.isArray(sources) ? sources : [sources];
  const b: Binding = { label, sources: srcs as Knob[], lastValue: undefined, lastRun: 0, runs: 0, error: null };

  const run = () => {
    try {
      const out = transform(...srcs.map((s) => s.get()));
      if (b.runs > 0 && equality(out, b.lastValue)) return;
      b.lastValue = out;
      b.lastRun = performance.now();
      b.runs++;

      apply(out);
      registry.emit({ type: "binding:run", binding: b, value: out, t: b.lastRun } as RegistryEvent);
    } catch (e) {
      b.error = e as Error;
      const sourceLabels = srcs.map((s) => s.label).join(", ");
      const errorMsg = (e as Error).message || String(e);
      registry.emit({ type: "binding:error", binding: b, error: errorMsg, t: performance.now() } as RegistryEvent);
      reportError(e as Error, { label: b.label, phase: "binding" });
      console.error(
        `[RatatUI] Binding error [${b.label}]: ${errorMsg}\n` +
        `  Sources: [${sourceLabels}]\n` +
        `  Last known values: [${srcs.map((s) => s.get()).join(", ")}]`
      );
    }
  };

  const unsubs = srcs.map((s) => s.subscribe(() => schedule(run, b)));
  registry.bindings.add(b);
  registry.emit({ type: "binding:create", binding: b } as RegistryEvent);
  run();

  return () => {
    unsubs.forEach((u) => u());
    registry.bindings.delete(b);
    registry.emit({ type: "binding:dispose", binding: b } as RegistryEvent);
  };
}
