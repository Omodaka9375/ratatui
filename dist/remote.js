// remote.ts — async data as knobs. Loading states become bindable like
// everything else. Stale responses are dropped (last-write-wins).
import { knob } from "./knob.js";
let autoId = 0;
export function remote(fetcher, options = {}) {
    const { label = `remote#${++autoId}`, initial = null } = options;
    const data = knob(initial, `${label}:data`);
    const status = knob("idle", `${label}:status`);
    const error = knob(null, `${label}:error`);
    let seq = 0;
    let controller = null;
    async function load(...args) {
        controller?.abort();
        controller = new AbortController();
        const my = ++seq;
        status.set("loading");
        error.set(null);
        try {
            const result = await fetcher(...args, { signal: controller.signal });
            if (my !== seq)
                return;
            data.set(result);
            status.set("ready");
            return result;
        }
        catch (err) {
            if (my !== seq)
                return;
            if (err.name === "AbortError")
                return;
            error.set(err);
            status.set("error");
        }
    }
    return {
        data, status, error, load,
        dispose() { controller?.abort(); seq++; data.dispose(); status.dispose(); error.dispose(); },
    };
}
