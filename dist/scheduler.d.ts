import type { Binding } from './types.js';
export declare const activeBindings: Set<Binding>;
export declare function schedule(job: () => void, binding?: Binding | null): void;
export declare function flushSync(): void;
/**
 * batch(fn) — Group multiple knob.set() calls into a single microtask tick.
 * All scheduled updates inside the callback will be flushed together.
 */
export declare function batch(fn: () => void): void;
