// scope.ts — disposal discipline. One scope per view; wires die with the view.
import { bind as _bind } from './bind.js';
export function scope(label = 'scope') {
    const disposers = new Set();
    let disposed = false;
    const api = {
        label,
        add(disposer) {
            if (disposed) {
                disposer();
                return () => { };
            }
            disposers.add(disposer);
            return disposer;
        },
        bind(sourceOrSources, transform, apply, bindLabel) {
            return api.add(_bind(sourceOrSources, transform, apply, bindLabel));
        },
        own(obj) {
            api.add(() => obj.dispose?.());
            return obj;
        },
        dispose() {
            disposed = true;
            disposers.forEach((d) => d());
            disposers.clear();
        },
    };
    return api;
}
