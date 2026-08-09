import type { Knob, Derived } from './types.js';
export declare function derive<T, U>(source: Knob<T>, transform: (value: T) => U, label?: string): Derived<U>;
export declare function derive<T extends readonly unknown[], U>(sources: {
    [K in keyof T]: Knob<T[K]>;
}, transform: (...args: T) => U, label?: string): Derived<U>;
