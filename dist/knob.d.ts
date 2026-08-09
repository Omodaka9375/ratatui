import type { Knob, KnobOptions } from './types.js';
export declare function knob<T>(initial: T, labelOrOpts?: string | KnobOptions<T>): Knob<T>;
