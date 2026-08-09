import { scope as makeScope } from "./scope.js";
import type { Knob } from "./types.js";
export declare function show(el: HTMLElement, source: Knob<any>, predicate?: (v: any) => boolean, label?: string): () => void;
export declare function clone(templateOrSelector: string | HTMLTemplateElement): Element;
export declare function swap<T>(container: HTMLElement, source: Knob<T>, resolve: (value: T, scope: ReturnType<typeof makeScope>) => Element | null, label?: string): () => void;
