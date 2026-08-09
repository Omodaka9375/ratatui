import { scope as makeScope } from "./scope.js";
import type { Knob } from "./types.js";
export declare function list<T>(container: HTMLElement, source: Knob<T[]>, render: (item: Knob<T>, rowScope: ReturnType<typeof makeScope>) => Element, options?: {
    key?: (item: T, index: number) => string | number;
    label?: string;
}): () => void;
