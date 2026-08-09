// deep-equality.ts — configurable deep equality for knob updates.
// ponytail: O(n) structural comparison; for large graphs consider immer or fast-deep-equal.

/**
 * Deep equality check for primitive values, arrays, and plain objects.
 * Detects circular references and handles them correctly.
 * Does not handle functions, dates, or regexes specially.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  const visited = new WeakMap<object, WeakSet<object>>();

  function eq(x: unknown, y: unknown): boolean {
    if (Object.is(x, y)) return true;

    if (x == null || y == null) return x === y;
    if (typeof x !== typeof y) return false;

    if (Array.isArray(x) && Array.isArray(y)) {
      if (visited.has(x) && visited.get(x)!.has(y)) return true;
      addVisited(x, y);

      if (x.length !== y.length) return false;
      for (let i = 0; i < x.length; i++) {
        if (!eq(x[i], y[i])) return false;
      }
      return true;
    }

    if (typeof x === "object" && typeof y === "object") {
      if (visited.has(x) && visited.get(x)!.has(y)) return true;
      addVisited(x, y);

      const aProto = Object.getPrototypeOf(x);
      const bProto = Object.getPrototypeOf(y);

      if (aProto !== bProto && aProto !== null && bProto !== null) {
        return false;
      }

      const keysA = Object.keys(x);
      const keysB = Object.keys(y);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(y, key)) return false;
        if (!eq((x as any)[key], (y as any)[key])) return false;
      }
      return true;
    }

    return false;
  }

  function addVisited(x: object, y: object): void {
    if (!visited.has(x)) visited.set(x, new WeakSet());
    visited.get(x)!.add(y);
  }

  return eq(a, b);
}

export function refEqual<T>(a: T, b: T): boolean {
  return Object.is(a, b);
}
