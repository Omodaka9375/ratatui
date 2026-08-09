import type { Knob } from "./types.js";
export declare function remote<T>(fetcher: (...args: any[]) => Promise<T>, options?: {
    label?: string;
    initial?: T;
}): {
    data: Knob<T>;
    status: Knob<"error" | "idle" | "loading" | "ready">;
    error: Knob<Error | null>;
    load: (...args: any[]) => Promise<T | undefined>;
    dispose(): void;
};
