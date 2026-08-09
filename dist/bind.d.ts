import type { Source, Sources } from './types.js';
export declare function bind<T, U>(source: Source<T>, transform: (value: T) => U, apply: (value: U) => void, label?: string, equality?: (a: U, b: U) => boolean): () => void;
export declare function bind<T extends readonly unknown[], U>(sources: Sources<T>, transform: (...args: T) => U, apply: (value: U) => void, label?: string, equality?: (a: U, b: U) => boolean): () => void;
