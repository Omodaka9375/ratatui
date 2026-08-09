export interface Adapter {
    load(): Promise<{
        snapshot: any;
        version: string | null;
    } | null>;
    persist: (snapshot: any, context: {
        version: string | null;
        label: string;
    }) => Promise<{
        version?: string | null;
    }>;
}
/** A static token or a lazy getter resolved per request. */
export type TokenSource = string | (() => string | null | undefined);
export declare function localAdapter(storageKey: string): Adapter;
export declare function restAdapter(url: string, options?: {
    fetchImpl?: typeof fetch;
    headers?: Record<string, string>;
    token?: TokenSource;
}): Adapter;
export declare function githubAdapter(opts: {
    owner: string;
    repo: string;
    path: string;
    token?: TokenSource;
    branch?: string;
    fetchImpl?: typeof fetch;
}): Adapter;
export declare function cfAdapter(workerUrl: string, options?: {
    token?: TokenSource;
    fetchImpl?: typeof fetch;
}): Adapter;
export declare function pinataAdapter(opts: {
    name: string;
    jwt?: TokenSource;
    gateway?: string;
    network?: "public" | "private";
    fetchImpl?: typeof fetch;
}): Adapter;
export declare const ipfsAdapter: typeof pinataAdapter;
