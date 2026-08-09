// utils.ts — utility functions for signal manipulation.

import { knob } from "./knob.js";
import type { Knob } from "./types.js";

/**
 * Create a debounced version of a knob.
 * The value is only set after `ms` milliseconds of inactivity.
 */
export function debounce<T>(source: Knob<T>, ms: number): Knob<T> {
  const debounced = knob(source.get(), `${source.label}:debounced`);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsub = source.subscribe((value) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      debounced.set(value);
    }, ms);
  });

  const origDispose = debounced.dispose;
  debounced.dispose = () => {
    if (timer) clearTimeout(timer);
    unsub();
    origDispose();
  };

  return debounced;
}

/**
 * Create a throttled version of a knob.
 * The value is updated at most once every `ms` milliseconds.
 */
export function throttle<T>(source: Knob<T>, ms: number): Knob<T> {
  const throttled = knob(source.get(), `${source.label}:throttled`);
  let lastUpdate = 0;
  let pending: T | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (pending !== null) {
      throttled.set(pending);
      pending = null;
    }
  };

  const unsub = source.subscribe((value) => {
    const now = performance.now();
    if (now - lastUpdate >= ms) {
      lastUpdate = now;
      throttled.set(value);
    } else {
      pending = value;
      if (timer === null) {
        timer = setTimeout(flush, ms);
      }
    }
  });

  const origDispose = throttled.dispose;
  throttled.dispose = () => {
    if (timer) clearTimeout(timer);
    unsub();
    origDispose();
  };

  return throttled;
}

/**
 * Create a knob that only updates when the value changes (deep equality check).
 * Useful for objects/arrays where reference changes don't mean content changes.
 */
export function distinct<T>(source: Knob<T>, equalityFn?: (a: T, b: T) => boolean): Knob<T> {
  const eq = equalityFn ?? ((a, b) => a === b);
  const dk = knob(source.get(), `${source.label}:distinct`);

  const unsub = source.subscribe((value) => {
    if (!eq(value, dk.get())) {
      dk.set(value);
    }
  });

  const origDispose = dk.dispose;
  dk.dispose = () => { unsub(); origDispose(); };

  return dk;
}

/**
 * Map a knob's value through a transformation function.
 * Similar to derive() but returns a writable knob.
 */
export function map<T, U>(
  source: Knob<T>,
  transform: (value: T) => U,
  reverse: (value: U) => T,
  label?: string
): Knob<U> {
  const mapped = knob(transform(source.get()), label ?? `${source.label}:mapped`);

  const unsubSrc = source.subscribe((value) => {
    mapped.set(transform(value));
  });

  // Optional reverse mapping (for two-way binding)
  const unsubRev = mapped.subscribe((value) => {
    try {
      source.set(reverse(value));
    } catch {
      // Ignore reverse errors
    }
  });

  const origDispose = mapped.dispose;
  mapped.dispose = () => { unsubSrc(); unsubRev(); origDispose(); };

  return mapped;
}

/**
 * Combine multiple knobs into a single object-shaped knob.
 */
export function combine<T extends Record<string, Knob<any>>>(
  knobs: T
): Knob<{ [K in keyof T]: ReturnType<T[K]["get"]> }> {
  const keys = Object.keys(knobs) as Array<keyof T>;
  const initial = Object.fromEntries(keys.map((k) => [k, knobs[k].get()])) as {
    [K in keyof T]: ReturnType<T[K]["get"]>;
  };

  const combined = knob(initial, "combined");

  const unsubs = keys.map((k) =>
    knobs[k].subscribe(() => {
      combined.set(Object.fromEntries(keys.map((key) => [key, knobs[key].get()])) as {
        [KK in keyof T]: ReturnType<T[KK]["get"]>;
      });
    })
  );

  const originalDispose = combined.dispose;
  combined.dispose = () => {
    originalDispose();
    unsubs.forEach((u) => u());
  };

  return combined;
}

/**
 * Create a form helper that manages multiple fields as a single object.
 * Provides get/set for the entire form and individual field access.
 *
 * @example
 * const form = formHelper({
 *   name: knob(""),
 *   email: knob(""),
 *   age: knob(0)
 * });
 *
 * form.set({ name: "Alice", email: "alice@example.com", age: 30 });
 * const name = form.getField("name").get();
 */
export function formHelper<T extends Record<string, Knob<any>>>(
  fields: T,
  label: string = "form"
): {
  get: () => { [K in keyof T]: ReturnType<T[K]["get"]> };
  set: (values: Partial<{ [K in keyof T]: ReturnType<T[K]["get"]> }>) => void;
  getField: <K extends keyof T>(key: K) => Knob<ReturnType<T[K]["get"]>>;
  reset: () => void;
  dispose: () => void;
} {
  const initial = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, v.get()])
  ) as { [K in keyof T]: ReturnType<T[K]["get"]> };

  let current = { ...initial } as any;
  const originalFields = { ...fields };

  const api = {
    get: () => ({ ...current }),
    set: (values: Partial<{ [K in keyof T]: ReturnType<T[K]["get"]> }>) => {
      Object.entries(values).forEach(([key, value]) => {
        if (key in fields && value !== undefined) {
          (fields[key] as Knob<any>).set(value as any);
          (current as any)[key] = value as any;
        }
      });
    },
    getField: <K extends keyof T>(key: K): Knob<ReturnType<T[K]["get"]>> => {
      return fields[key] as Knob<ReturnType<T[K]["get"]>>;
    },
    reset: () => {
      Object.entries(originalFields).forEach(([key, field]) => {
        field.set((initial as any)[key]);
        (current as any)[key] = (initial as any)[key];
      });
    },
    dispose: () => {
      Object.values(fields).forEach((f) => f.dispose());
    },
  };

  // Sync internal state when individual fields change
  Object.entries(fields).forEach(([key, field]) => {
    field.subscribe((value) => {
      (current as any)[key] = value;
    });
  });

  return api;
}
