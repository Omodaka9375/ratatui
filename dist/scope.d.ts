import type { Source, Sources } from './types.js';
export interface Scope {
    label: string;
    add: (disposer: () => void) => () => void;
    bind<T, U>(source: Source<T>, transform: (value: T) => U, apply: (value: U) => void, label?: string): () => void;
    bind<T extends readonly unknown[], U>(sources: Sources<T>, transform: (...args: T) => U, apply: (value: U) => void, label?: string): () => void;
    own: <T>(obj: {
        dispose?: () => void;
    } & T) => T;
    dispose: () => void;
}
export declare function scope(label?: string): Scope;
