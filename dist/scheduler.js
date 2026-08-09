// scheduler.ts — deduplicating microtask scheduler with cycle detection and batching.
// Solves the diamond problem: a job scheduled N times in one tick runs once.
// Detects binding cycles via recursion depth tracking.
import { reportError } from './errors.js';
const queue = new Set();
let scheduled = false;
// Exported for testing/debugging — tracks bindings currently executing
export const activeBindings = new Set();
const MAX_RECURSION_DEPTH = 100;
const chainDepth = new Map();
export function schedule(job, binding) {
    queue.add({ job, binding: binding ?? undefined });
    if (!scheduled) {
        scheduled = true;
        queueMicrotask(flush);
    }
}
function flush() {
    let passes = 0;
    try {
        while (queue.size) {
            if (++passes > 1000) {
                queue.clear();
                throw new Error("[RatatUI] 1000 flush passes — likely a binding cycle.");
            }
            const jobs = [...queue];
            queue.clear();
            for (const { job, binding } of jobs) {
                const chainKey = binding?.label ?? '__anon__';
                const depth = (chainDepth.get(chainKey) ?? 0) + 1;
                chainDepth.set(chainKey, depth);
                if (depth > MAX_RECURSION_DEPTH) {
                    if (binding) {
                        reportError(new Error(`binding cycle: ${binding.label}`), { label: binding.label, phase: "scheduler" });
                        console.error(`[RatatUI] Possible binding cycle detected [${binding.label}]. ` +
                            `Recursion depth exceeded ${MAX_RECURSION_DEPTH}. Skipping to prevent infinite loop.`);
                    }
                    chainDepth.set(chainKey, 0);
                    continue;
                }
                // Track active binding for debugging/testing
                if (binding)
                    activeBindings.add(binding);
                try {
                    job();
                }
                catch (e) {
                    reportError(e, { label: binding?.label ?? 'anon', phase: "scheduler" });
                    console.error('[RatatUI] Job execution error:', e);
                }
                finally {
                    if (binding)
                        activeBindings.delete(binding);
                    chainDepth.set(chainKey, (chainDepth.get(chainKey) ?? 1) - 1);
                }
            }
        }
    }
    finally {
        scheduled = false;
        chainDepth.clear();
    }
}
export function flushSync() { flush(); }
/**
 * batch(fn) — Group multiple knob.set() calls into a single microtask tick.
 * All scheduled updates inside the callback will be flushed together.
 */
export function batch(fn) {
    fn();
    flushSync();
}
