// derive.ts — lazy computed knob. Recalculates only when get() is called and sources changed.
// ponytail: Lazy evaluation trades CPU for reduced computation when derived values are rarely read.
import { schedule } from './scheduler.js';
import { reportError } from './errors.js';
export function derive(sources, transform, label = 'derived') {
    const srcs = Array.isArray(sources) ? sources : [sources];
    let cachedValue;
    let dirty = true;
    const compute = () => {
        if (!dirty)
            return cachedValue;
        try {
            const result = transform(...srcs.map((s) => s.get()));
            cachedValue = result;
            dirty = false;
            return result;
        }
        catch (e) {
            reportError(e, { label, phase: "derive" });
            console.error(`[RatatUI] Derive compute error [${label}]:`, e);
            dirty = false; // don't retry until a source changes again
            return cachedValue;
        }
    };
    const getValue = () => {
        if (dirty) {
            return compute();
        }
        return cachedValue;
    };
    const subs = new Set();
    // Subscribe to sources to mark as dirty and notify subscribers
    const unsubs = srcs.map((s) => s.subscribe(() => {
        dirty = true;
        if (subs.size > 0) {
            const newValue = compute();
            for (const fn of subs)
                schedule(() => fn(newValue));
        }
    }));
    // Initial compute
    compute();
    const api = {
        label,
        get: getValue,
        subscribe: (fn) => {
            subs.add(fn);
            // Immediately call with current value
            fn(getValue());
            return () => subs.delete(fn);
        },
        dispose: () => {
            unsubs.forEach((u) => u());
            subs.clear();
            cachedValue = undefined;
        },
    };
    return api;
}
