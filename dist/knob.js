// knob.ts — the atom. One knob = one value = one function.
// Supports optional schema validation: min, max, pattern, validator.
import { schedule } from './scheduler.js';
import { registry } from './registry.js';
import { reportError } from './errors.js';
let autoId = 0;
export function knob(initial, labelOrOpts) {
    const opts = typeof labelOrOpts === 'string'
        ? { label: labelOrOpts }
        : { label: `knob#${++autoId}`, ...labelOrOpts };
    const equality = opts.equality ?? ((a, b) => Object.is(a, b));
    let value = initial;
    const subs = new Set();
    let disposed = false;
    // Validation helper
    const validate = (newValue) => {
        const { min, max, pattern, validator, errorMessage } = opts;
        if (min !== undefined && newValue < min) {
            return errorMessage || `Value must be >= ${min}`;
        }
        if (max !== undefined && newValue > max) {
            return errorMessage || `Value must be <= ${max}`;
        }
        if (pattern !== undefined && typeof newValue === 'string') {
            if (!pattern.test(newValue)) {
                return errorMessage || `Value must match pattern ${pattern}`;
            }
        }
        if (validator !== undefined && typeof validator === 'function') {
            const result = validator(newValue);
            if (result === false || (typeof result === 'string' && result)) {
                return errorMessage || (typeof result === 'string' ? result : 'Validation failed');
            }
        }
        return null; // Valid
    };
    const k = {
        label: opts.label,
        get: () => {
            if (disposed)
                console.warn(`[RatatUI] knob.get() called on disposed knob [${opts.label}]`);
            return value;
        },
        set: (next) => {
            if (disposed) {
                console.warn(`[RatatUI] knob.set() called on disposed knob [${opts.label}]`);
                return;
            }
            if (equality(next, value))
                return;
            // Validate before setting
            const error = validate(next);
            if (error) {
                const valStr = typeof next === 'string' ? `"${next}"` : String(next);
                console.warn(`[RatatUI] Validation failed [${opts.label}]: ${error} (got: ${valStr})`);
                registry.emit({ type: "knob:validation:error", knob: k, value: next, error });
                return; // Don't set invalid value
            }
            const prev = value;
            value = next;
            registry.emit({ type: "knob:set", knob: k, prev, value: next, t: performance.now() });
            // Call onUpdate hook if provided
            if (opts.onUpdate) {
                try {
                    opts.onUpdate(next, prev);
                }
                catch (e) {
                    reportError(e, { label: opts.label, phase: "hook" });
                    console.error(`[RatatUI] onUpdate hook error [${opts.label}]:`, e);
                }
            }
            for (const fn of subs)
                schedule(() => fn(value));
        },
        update: (fn) => { k.set(fn(value)); },
        subscribe: (fn) => {
            if (disposed) {
                console.warn(`[RatatUI] knob.subscribe() called on disposed knob [${opts.label}]`);
                fn(value);
                return () => { };
            }
            subs.add(fn);
            return () => subs.delete(fn);
        },
        dispose: () => {
            if (disposed)
                return;
            disposed = true;
            subs.clear();
            registry.knobs.delete(k);
            registry.emit({ type: "knob:dispose", knob: k });
        },
    };
    registry.knobs.add(k);
    registry.emit({ type: "knob:create", knob: k });
    return k;
}
