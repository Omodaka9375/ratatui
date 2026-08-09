/**
 * Deep equality check for primitive values, arrays, and plain objects.
 * Detects circular references and handles them correctly.
 * Does not handle functions, dates, or regexes specially.
 */
export declare function deepEqual(a: unknown, b: unknown): boolean;
export declare function refEqual<T>(a: T, b: T): boolean;
