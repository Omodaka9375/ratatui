// registry.ts — global registry + event bus. The Inspector is a subscriber.

import type { Knob, Binding, RegistryEvent } from './types.js';

export const registry = {
  knobs: new Set<Knob>(),
  bindings: new Set<Binding>(),
  _listeners: new Set<(event: RegistryEvent) => void>(),
  emit(event: RegistryEvent): void {
    for (const fn of this._listeners) fn(event);
  },
  onEvent(fn: (event: RegistryEvent) => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  },
};
