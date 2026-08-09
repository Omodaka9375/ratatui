import { scope as makeScope } from "./scope.js";
import type { Knob } from "./types.js";
interface Route {
    path: string;
    mount: (ctx: {
        params: Record<string, string>;
        scope: ReturnType<typeof makeScope>;
        navigate: (path: string) => void;
    }) => void;
}
interface Router {
    current: Knob<{
        path: string;
        params: Record<string, string>;
    } | null>;
    navigate: (path: string) => void;
    dispose: () => void;
}
export declare function router(routes: Route[], options?: {
    fallback?: string;
}): Router;
export {};
