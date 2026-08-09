// remote.ts — async data as knobs. Loading states become bindable like
// everything else. Stale responses are dropped (last-write-wins).

import { knob } from "./knob.js";
import type { Knob } from "./types.js";

let autoId = 0;

export function remote<T>(
  fetcher: (...args: any[]) => Promise<T>,
  options: { label?: string; initial?: T } = {}
) {
  const { label = `remote#${++autoId}`, initial = null as unknown as T } = options;

  const data = knob(initial, `${label}:data`);
  const status = knob<"idle" | "loading" | "ready" | "error">("idle", `${label}:status`);
  const error = knob<Error | null>(null, `${label}:error`);
  let seq = 0;
  let controller: AbortController | null = null;

  async function load(...args: any[]) {
    controller?.abort();
    controller = new AbortController();
    const my = ++seq;
    status.set("loading");
    error.set(null);
    try {
      const result = await fetcher(...args, { signal: controller.signal });
      if (my !== seq) return;
      data.set(result);
      status.set("ready");
      return result;
    } catch (err) {
      if (my !== seq) return;
      if ((err as Error).name === "AbortError") return;
      error.set(err as Error);
      status.set("error");
    }
  }

  return {
    data, status, error, load,
    dispose() { controller?.abort(); seq++; data.dispose(); status.dispose(); error.dispose(); },
  };
}
