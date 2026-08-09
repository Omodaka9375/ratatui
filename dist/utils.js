// utils.ts — utility functions for signal manipulation.
import { knob } from "./knob.js";
/**
 * Create a debounced version of a knob.
 * The value is only set after `ms` milliseconds of inactivity.
 */
export function debounce(source, ms) {
    const debounced = knob(source.get(), `${source.label}:debounced`);
    let timer = null;
    const unsub = source.subscribe((value) => {
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() => {
            debounced.set(value);
        }, ms);
    });
    const origDispose = debounced.dispose;
    debounced.dispose = () => {
        if (timer)
            clearTimeout(timer);
        unsub();
        origDispose();
    };
    return debounced;
}
/**
 * Create a throttled version of a knob.
 * The value is updated at most once every `ms` milliseconds.
 */
export function throttle(source, ms) {
    const throttled = knob(source.get(), `${source.label}:throttled`);
    let lastUpdate = 0;
    let pending = null;
    let timer = null;
    const flush = () => {
        if (pending !== null) {
            throttled.set(pending);
            pending = null;
        }
    };
    const unsub = source.subscribe((value) => {
        const now = performance.now();
        if (now - lastUpdate >= ms) {
            lastUpdate = now;
            throttled.set(value);
        }
        else {
            pending = value;
            if (timer === null) {
                timer = setTimeout(flush, ms);
            }
        }
    });
    const origDispose = throttled.dispose;
    throttled.dispose = () => {
        if (timer)
            clearTimeout(timer);
        unsub();
        origDispose();
    };
    return throttled;
}
/**
 * Create a knob that only updates when the value changes (deep equality check).
 * Useful for objects/arrays where reference changes don't mean content changes.
 */
export function distinct(source, equalityFn) {
    const eq = equalityFn ?? ((a, b) => a === b);
    const dk = knob(source.get(), `${source.label}:distinct`);
    const unsub = source.subscribe((value) => {
        if (!eq(value, dk.get())) {
            dk.set(value);
        }
    });
    const origDispose = dk.dispose;
    dk.dispose = () => { unsub(); origDispose(); };
    return dk;
}
/**
 * Map a knob's value through a transformation function.
 * Similar to derive() but returns a writable knob.
 */
export function map(source, transform, reverse, label) {
    const mapped = knob(transform(source.get()), label ?? `${source.label}:mapped`);
    const unsubSrc = source.subscribe((value) => {
        mapped.set(transform(value));
    });
    // Optional reverse mapping (for two-way binding)
    const unsubRev = mapped.subscribe((value) => {
        try {
            source.set(reverse(value));
        }
        catch {
            // Ignore reverse errors
        }
    });
    const origDispose = mapped.dispose;
    mapped.dispose = () => { unsubSrc(); unsubRev(); origDispose(); };
    return mapped;
}
/**
 * Combine multiple knobs into a single object-shaped knob.
 */
export function combine(knobs) {
    const keys = Object.keys(knobs);
    const initial = Object.fromEntries(keys.map((k) => [k, knobs[k].get()]));
    const combined = knob(initial, "combined");
    const unsubs = keys.map((k) => knobs[k].subscribe(() => {
        combined.set(Object.fromEntries(keys.map((key) => [key, knobs[key].get()])));
    }));
    const originalDispose = combined.dispose;
    combined.dispose = () => {
        originalDispose();
        unsubs.forEach((u) => u());
    };
    return combined;
}
/**
 * Create a form helper that manages multiple fields as a single object.
 * Provides get/set for the entire form and individual field access.
 *
 * @example
 * const form = formHelper({
 *   name: knob(""),
 *   email: knob(""),
 *   age: knob(0)
 * });
 *
 * form.set({ name: "Alice", email: "alice@example.com", age: 30 });
 * const name = form.getField("name").get();
 */
export function formHelper(fields, label = "form") {
    const initial = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.get()]));
    let current = { ...initial };
    const originalFields = { ...fields };
    const api = {
        get: () => ({ ...current }),
        set: (values) => {
            Object.entries(values).forEach(([key, value]) => {
                if (key in fields && value !== undefined) {
                    fields[key].set(value);
                    current[key] = value;
                }
            });
        },
        getField: (key) => {
            return fields[key];
        },
        reset: () => {
            Object.entries(originalFields).forEach(([key, field]) => {
                field.set(initial[key]);
                current[key] = initial[key];
            });
        },
        dispose: () => {
            Object.values(fields).forEach((f) => f.dispose());
        },
    };
    // Sync internal state when individual fields change
    Object.entries(fields).forEach(([key, field]) => {
        field.subscribe((value) => {
            current[key] = value;
        });
    });
    return api;
}
