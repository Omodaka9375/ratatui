import type { Knob } from "./types.js";
export declare class CommitConflict extends Error {
    serverSnapshot: any;
    serverVersion: string | null;
    constructor(serverSnapshot: any, serverVersion: string | null, message?: string);
}
export type ConflictState = {
    server: any;
    serverVersion: string | null;
};
export type SnapshotOf<T extends Record<string, Knob<any>>> = {
    [K in keyof T]: ReturnType<T[K]["get"]>;
};
export interface CommitBoundaryApi<T extends Record<string, Knob<any>>> {
    dirty: Knob<boolean>;
    status: Knob<string>;
    conflict: Knob<ConflictState | null>;
    snapshot: () => SnapshotOf<T>;
    readonly version: string | null;
    commit: () => Promise<any>;
    revert: () => void;
    acceptServer: () => void;
    forceMine: () => Promise<any>;
    dispose: () => void;
}
export interface DraftApi<T extends Record<string, Knob<any>>> extends CommitBoundaryApi<T> {
    save: () => Promise<any>;
    discard: () => void;
}
export interface DraftWithHistoryApi<T extends Record<string, Knob<any>>> extends CommitBoundaryApi<T> {
    undo: () => boolean;
    redo: () => boolean;
    canUndo: () => boolean;
    canRedo: () => boolean;
    historyLength: () => number;
    historyIndex: () => number;
}
export declare function commitBoundary<T extends Record<string, Knob<any>>>(knobs: T, persist: (snapshot: SnapshotOf<T>, context: {
    version: string | null;
    label: string;
}) => Promise<{
    version?: string | null;
}>, options?: {
    label?: string;
    autoCommit?: number;
    version?: string | null;
}): CommitBoundaryApi<T>;
/**
 * Create a draft with undo/redo history support.
 *
 * @example
 * const draft = draftWithHistory(signals, persist, { maxHistory: 50 });
 * draft.undo(); // Revert to previous state
 * draft.redo(); // Re-apply undone state
 * draft.canUndo(); // Check if undo is available
 * draft.canRedo(); // Check if redo is available
 */
export declare function draftWithHistory<T extends Record<string, Knob<any>>>(signals: T, persist: (snapshot: SnapshotOf<T>, context: {
    version: string | null;
    label: string;
}) => Promise<{
    version?: string | null;
}>, options?: {
    label?: string;
    autoCommit?: number;
    version?: string | null;
    maxHistory?: number;
}): DraftWithHistoryApi<T>;
export declare function draft<T extends Record<string, Knob<any>>>(signals: T, persist: (snapshot: SnapshotOf<T>, context: {
    version: string | null;
    label: string;
}) => Promise<{
    version?: string | null;
}>, options?: {
    label?: string;
    autoCommit?: number;
    version?: string | null;
}): DraftApi<T>;
export { CommitConflict as Conflict };
