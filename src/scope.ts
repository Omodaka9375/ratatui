// scope.ts — disposal discipline. One scope per view; wires die with the view.

import { bind as _bind } from './bind.js';
import type { Source, Sources } from './types.js';

export interface Scope {
  label: string;
  add: (disposer: () => void) => () => void;
  bind<T, U>(
    source: Source<T>,
    transform: (value: T) => U,
    apply: (value: U) => void,
    label?: string
  ): () => void;
  bind<T extends readonly unknown[], U>(
    sources: Sources<T>,
    transform: (...args: T) => U,
    apply: (value: U) => void,
    label?: string
  ): () => void;
  own: <T>(obj: { dispose?: () => void } & T) => T;
  dispose: () => void;
}

export function scope(label: string = 'scope'): Scope {
  const disposers = new Set<() => void>();
  let disposed = false;

  const api: Scope = {
    label,
    add(disposer: () => void): () => void {
      if (disposed) {
        disposer();
        return () => {};
      }
      disposers.add(disposer);
      return disposer;
    },
    bind(sourceOrSources: any, transform: any, apply: any, bindLabel?: string): () => void {
      return api.add(_bind(sourceOrSources, transform, apply, bindLabel));
    },
    own<T>(obj: { dispose?: () => void } & T): T {
      api.add(() => obj.dispose?.());
      return obj;
    },
    dispose(): void {
      disposed = true;
      disposers.forEach((d) => d());
      disposers.clear();
    },
  };
  return api;
}
