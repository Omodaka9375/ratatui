// router.ts — a hash router whose entire job is scope automation:
// one scope per route, disposed on navigation.

import { knob } from "./knob.js";
import { scope as makeScope } from "./scope.js";
import type { Knob } from "./types.js";

interface Route {
  path: string;
  mount: (ctx: { params: Record<string, string>; scope: ReturnType<typeof makeScope>; navigate: (path: string) => void }) => void;
}

interface Router {
  current: Knob<{ path: string; params: Record<string, string> } | null>;
  navigate: (path: string) => void;
  dispose: () => void;
}

export function router(routes: Route[], options: { fallback?: string } = {}): Router {
  const { fallback = "/" } = options;

  const current = knob<{ path: string; params: Record<string, string> } | null>(null, "router:current");
  let active: { scope: ReturnType<typeof makeScope> } | null = null;
  let disposed = false;

  const compile = (pattern: string) => {
    const names: string[] = [];
    const rx = new RegExp(
      "^" + pattern.replace(/:[^/]+/g, (m) => { names.push(m.slice(1)); return "([^/]+)"; }) + "$"
    );
    return { rx, names };
  };
  const table = routes.map((r) => ({ ...r, ...compile(r.path) }));

  const navigate = (path: string) => { location.hash = path; };

  const resolve = () => {
    if (disposed) return;
    const hash = location.hash.slice(1) || "/";
    for (const r of table) {
      const m = hash.match(r.rx);
      if (!m) continue;
      const params = Object.fromEntries(
        r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])
      );
      active?.scope.dispose();
      const s = makeScope(`route:${r.path}`);
      active = { scope: s };
      current.set({ path: r.path, params });
      r.mount({ params, scope: s, navigate });
      return;
    }
    if (hash !== fallback) navigate(fallback);
  };

  window.addEventListener("hashchange", resolve);
  resolve();

  return {
    current,
    navigate,
    dispose() {
      disposed = true;
      window.removeEventListener("hashchange", resolve);
      active?.scope.dispose();
      active = null;
    },
  };
}
