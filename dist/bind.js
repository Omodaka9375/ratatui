// bind.ts — the wire. [Source(s)] → [Transform] → [one Target].
// Runs at creation ("Always Ready"); skips identical outputs.
// Cycle detection: passes binding reference to scheduler.
import { registry } from './registry.js';
import { schedule } from './scheduler.js';
import { reportError } from './errors.js';
let autoId = 0;
export function bind(sources, transform, apply, label = `bind#${++autoId}`, equality = Object.is) {
    const srcs = Array.isArray(sources) ? sources : [sources];
    const b = { label, sources: srcs, lastValue: undefined, lastRun: 0, runs: 0, error: null };
    const run = () => {
        try {
            const out = transform(...srcs.map((s) => s.get()));
            if (b.runs > 0 && equality(out, b.lastValue))
                return;
            b.lastValue = out;
            b.lastRun = performance.now();
            b.runs++;
            apply(out);
            registry.emit({ type: "binding:run", binding: b, value: out, t: b.lastRun });
        }
        catch (e) {
            b.error = e;
            const sourceLabels = srcs.map((s) => s.label).join(", ");
            const errorMsg = e.message || String(e);
            registry.emit({ type: "binding:error", binding: b, error: errorMsg, t: performance.now() });
            reportError(e, { label: b.label, phase: "binding" });
            console.error(`[RatatUI] Binding error [${b.label}]: ${errorMsg}\n` +
                `  Sources: [${sourceLabels}]\n` +
                `  Last known values: [${srcs.map((s) => s.get()).join(", ")}]`);
        }
    };
    const unsubs = srcs.map((s) => s.subscribe(() => schedule(run, b)));
    registry.bindings.add(b);
    registry.emit({ type: "binding:create", binding: b });
    run();
    return () => {
        unsubs.forEach((u) => u());
        registry.bindings.delete(b);
        registry.emit({ type: "binding:dispose", binding: b });
    };
}
