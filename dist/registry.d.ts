import type { Knob, Binding, RegistryEvent } from './types.js';
export declare const registry: {
    knobs: Set<Knob>;
    bindings: Set<Binding>;
    _listeners: Set<(event: RegistryEvent) => void>;
    emit(event: RegistryEvent): void;
    onEvent(fn: (event: RegistryEvent) => void): () => void;
};
