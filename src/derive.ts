// derive.ts — lazy computed knob. Recalculates only when get() is called and sources changed.
// ponytail: Lazy evaluation trades CPU for reduced computation when derived values are rarely read.

import { schedule } from './scheduler.js';
import { reportError } from './errors.js';
import type { Knob, Derived } from './types.js';

export function derive<T, U>(
  source: Knob<T>,
  transform: (value: T) => U,
  label?: string
): Derived<U>;
export function derive<T extends readonly unknown[], U>(
  sources: { [K in keyof T]: Knob<T[K]> },
  transform: (...args: T) => U,
  label?: string
): Derived<U>;
export function derive(
  sources: Knob<any> | Knob<any>[],
  transform: (...args: any[]) => any,
  label: string = 'derived'
): Derived<any> {
  const srcs: Knob<any>[] = Array.isArray(sources) ? sources : [sources];

  let cachedValue: any;
  let dirty = true;

  const compute = (): any => {
    if (!dirty) return cachedValue;

    try {
      const result = transform(...srcs.map((s) => s.get()));
      cachedValue = result;
      dirty = false;
      return result;
    } catch (e) {
      reportError(e as Error, { label, phase: "derive" });
      console.error(`[RatatUI] Derive compute error [${label}]:`, e);
      dirty = false; // don't retry until a source changes again
      return cachedValue;
    }
  };

  const getValue = (): any => {
    if (dirty) {
      return compute();
    }
    return cachedValue;
  };

  const subs = new Set<(val: any) => void>();

  // Subscribe to sources to mark as dirty and notify subscribers
  const unsubs = srcs.map((s) =>
    s.subscribe(() => {
      dirty = true;
      if (subs.size > 0) {
        const newValue = compute();
        for (const fn of subs) schedule(() => fn(newValue));
      }
    })
  );

  // Initial compute
  compute();

  const api: Derived<any> = {
    label,
    get: getValue,
    subscribe: (fn: (val: any) => void): (() => void) => {
      subs.add(fn);
      // Immediately call with current value
      fn(getValue());
      return () => subs.delete(fn);
    },
    dispose: () => {
      unsubs.forEach((u) => u());
      subs.clear();
      cachedValue = undefined;
    },
  };

  return api;
}
