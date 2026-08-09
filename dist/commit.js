// commit.ts — the Commit Boundary. Play is free; consequence is explicit.
// autoCommit: debounced auto-save. Conflicts: CommitConflict → bindable knobs.
import { knob } from "./knob.js";
export class CommitConflict extends Error {
    constructor(serverSnapshot, serverVersion, message = "Commit conflict") {
        super(message);
        this.name = "CommitConflict";
        this.serverSnapshot = serverSnapshot;
        this.serverVersion = serverVersion;
    }
}
export function commitBoundary(knobs, persist, options = {}) {
    const { label = "patch", autoCommit = 0, version: initialVersion = null } = options;
    const snapshot = () => Object.fromEntries(Object.entries(knobs).map(([key, n]) => [key, n.get()]));
    let saved = snapshot();
    let version = initialVersion;
    let inFlight = null;
    let timer = null;
    const dirty = knob(false, `${label}:dirty`);
    const status = knob("idle", `${label}:status`);
    const conflict = knob(null, `${label}:conflict`);
    const recompute = () => {
        const now = snapshot();
        const isDirty = Object.keys(now).some((k) => !Object.is(now[k], saved[k]));
        dirty.set(isDirty);
        if (isDirty && autoCommit > 0 && !conflict.get()) {
            clearTimeout(timer);
            timer = setTimeout(() => api.commit(), autoCommit);
        }
        else if (!isDirty) {
            clearTimeout(timer);
        }
    };
    const unsubs = Object.values(knobs).map((n) => n.subscribe(recompute));
    async function doCommit() {
        const snap = snapshot();
        status.set("saving");
        try {
            const result = await persist(snap, { version, label });
            saved = snap;
            if (result && result.version !== undefined)
                version = result.version;
            conflict.set(null);
            status.set("saved");
            recompute();
            return snap;
        }
        catch (err) {
            if (err instanceof CommitConflict) {
                conflict.set({ server: err.serverSnapshot, serverVersion: err.serverVersion });
                status.set("conflict");
                return null;
            }
            status.set("error");
            throw err;
        }
        finally {
            inFlight = null;
        }
    }
    const api = {
        dirty, status, conflict, snapshot,
        get version() { return version; },
        commit() {
            clearTimeout(timer);
            if (inFlight)
                return inFlight;
            inFlight = doCommit();
            return inFlight;
        },
        revert() {
            clearTimeout(timer);
            Object.entries(saved).forEach(([key, v]) => knobs[key].set(v));
        },
        acceptServer() {
            const c = conflict.get();
            if (!c)
                return;
            Object.entries(c.server).forEach(([key, v]) => knobs[key]?.set(v));
            saved = { ...c.server };
            version = c.serverVersion;
            conflict.set(null);
            status.set("idle");
            recompute();
        },
        forceMine() {
            const c = conflict.get();
            if (!c)
                return Promise.resolve(null);
            version = c.serverVersion;
            conflict.set(null);
            status.set("idle");
            return api.commit();
        },
        dispose() {
            clearTimeout(timer);
            unsubs.forEach((u) => u());
            dirty.dispose();
            status.dispose();
            conflict.dispose();
        },
    };
    return api;
}
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
export function draftWithHistory(signals, persist, options = {}) {
    const { maxHistory = 50 } = options;
    const history = [];
    let historyIndex = -1;
    let isReplaying = false;
    const api = commitBoundary(signals, persist, options);
    const snapshot = () => Object.fromEntries(Object.entries(signals).map(([key, n]) => [key, n.get()]));
    const pushHistory = (snap) => {
        if (isReplaying)
            return;
        // Remove any redo states if we're in the middle of history
        const trimmed = history.slice(0, historyIndex + 1);
        trimmed.push(snap);
        // Trim to max size
        if (trimmed.length > maxHistory) {
            trimmed.shift();
        }
        else {
            historyIndex++;
        }
        // Write back the trimmed array
        history.length = 0;
        history.push(...trimmed);
    };
    // Initialize history with current state
    history.push(snapshot());
    historyIndex = 0;
    const canUndo = () => historyIndex > 0;
    const canRedo = () => historyIndex < history.length - 1;
    const undo = () => {
        if (!canUndo())
            return false;
        isReplaying = true;
        historyIndex--;
        const prev = history[historyIndex];
        Object.entries(prev).forEach(([key, v]) => signals[key]?.set(v));
        isReplaying = false;
        return true;
    };
    const redo = () => {
        if (!canRedo())
            return false;
        isReplaying = true;
        historyIndex++;
        const next = history[historyIndex];
        Object.entries(next).forEach(([key, v]) => signals[key]?.set(v));
        isReplaying = false;
        return true;
    };
    // Override commit to save history
    const originalCommit = api.commit.bind(api);
    api.commit = async () => {
        const result = await originalCommit();
        if (result) {
            // Push to history after successful commit
            history.length = historyIndex + 1;
            history.push(snapshot());
            historyIndex++;
        }
        return result;
    };
    // Override revert to save history
    const originalRevert = api.revert.bind(api);
    api.revert = () => {
        if (canUndo()) {
            pushHistory(snapshot());
        }
        originalRevert();
    };
    const enhancedApi = api;
    enhancedApi.undo = undo;
    enhancedApi.redo = redo;
    enhancedApi.canUndo = canUndo;
    enhancedApi.canRedo = canRedo;
    enhancedApi.historyLength = () => history.length;
    enhancedApi.historyIndex = () => historyIndex;
    return enhancedApi;
}
export function draft(signals, persist, options) {
    const api = commitBoundary(signals, persist, options);
    const d = api;
    d.save = api.commit;
    d.discard = api.revert;
    return d;
}
export { CommitConflict as Conflict };
