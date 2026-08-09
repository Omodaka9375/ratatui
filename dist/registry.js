// registry.ts — global registry + event bus. The Inspector is a subscriber.
export const registry = {
    knobs: new Set(),
    bindings: new Set(),
    _listeners: new Set(),
    emit(event) {
        for (const fn of this._listeners)
            fn(event);
    },
    onEvent(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    },
};
