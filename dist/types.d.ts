export type EqualityFn<T = any> = (a: T, b: T) => boolean;
export type KnobOptions<T = any> = {
    label?: string;
    min?: number;
    max?: number;
    pattern?: RegExp;
    validator?: (value: T) => boolean | string;
    errorMessage?: string;
    equality?: EqualityFn<T>;
    onUpdate?: (newValue: T, oldValue: T) => void;
};
export type Knob<T = any> = {
    label: string;
    get: () => T;
    set: (next: T) => void;
    update: (fn: (val: T) => T) => void;
    subscribe: (fn: (val: T) => void) => () => void;
    dispose: () => void;
};
export type Derived<T = any> = {
    label: string;
    get: () => T;
    subscribe: (fn: (val: T) => void) => () => void;
    dispose: () => void;
};
/** A reactive source that bind/derive can read from. */
export type Source<T = any> = Knob<T> | Derived<T>;
/** Maps a tuple of value types to a tuple of matching sources. */
export type Sources<T extends readonly unknown[]> = {
    [K in keyof T]: Source<T[K]>;
};
export type Binding = {
    label: string;
    sources: (Knob<any> | Derived<any>)[];
    lastValue: any;
    lastRun: number;
    runs: number;
    error: Error | null;
};
export type RegistryEvent = {
    type: "knob:create";
    knob: Knob;
} | {
    type: "knob:set";
    knob: Knob;
    prev: any;
    value: any;
    t: number;
} | {
    type: "knob:dispose";
    knob: Knob;
} | {
    type: "knob:validation:error";
    knob: Knob;
    value: any;
    error: string;
} | {
    type: "binding:create";
    binding: Binding;
} | {
    type: "binding:run";
    binding: Binding;
    value: any;
    t: number;
} | {
    type: "binding:dispose";
    binding: Binding;
} | {
    type: "binding:error";
    binding: Binding;
    error: string;
    t: number;
};
