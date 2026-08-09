import type { Knob, Derived } from "./types.js";
import type { Adapter } from "./adapters.js";
import type { DraftApi } from "./commit.js";
/** Handle returned by autocms(). dispose() tears down every binding, listener, and DOM node it created. */
export interface AutocmsApi {
    signals: Record<string, Knob<any>>;
    draft: DraftApi<Record<string, Knob<any>>>;
    editing: Knob<string>;
    isEditing: Derived<boolean>;
    adapter: Adapter;
    dispose: () => void;
}
export declare function autocms(userOptions?: Record<string, any>): Promise<AutocmsApi>;
