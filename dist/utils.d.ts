import type { Knob } from "./types.js";
/**
 * Create a debounced version of a knob.
 * The value is only set after `ms` milliseconds of inactivity.
 */
export declare function debounce<T>(source: Knob<T>, ms: number): Knob<T>;
/**
 * Create a throttled version of a knob.
 * The value is updated at most once every `ms` milliseconds.
 */
export declare function throttle<T>(source: Knob<T>, ms: number): Knob<T>;
/**
 * Create a knob that only updates when the value changes (deep equality check).
 * Useful for objects/arrays where reference changes don't mean content changes.
 */
export declare function distinct<T>(source: Knob<T>, equalityFn?: (a: T, b: T) => boolean): Knob<T>;
/**
 * Map a knob's value through a transformation function.
 * Similar to derive() but returns a writable knob.
 */
export declare function map<T, U>(source: Knob<T>, transform: (value: T) => U, reverse: (value: U) => T, label?: string): Knob<U>;
/**
 * Combine multiple knobs into a single object-shaped knob.
 */
export declare function combine<T extends Record<string, Knob<any>>>(knobs: T): Knob<{
    [K in keyof T]: ReturnType<T[K]["get"]>;
}>;
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
export declare function formHelper<T extends Record<string, Knob<any>>>(fields: T, label?: string): {
    get: () => {
        [K in keyof T]: ReturnType<T[K]["get"]>;
    };
    set: (values: Partial<{
        [K in keyof T]: ReturnType<T[K]["get"]>;
    }>) => void;
    getField: <K extends keyof T>(key: K) => Knob<ReturnType<T[K]["get"]>>;
    reset: () => void;
    dispose: () => void;
};
