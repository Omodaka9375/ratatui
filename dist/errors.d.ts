export type ErrorContext = {
    label: string;
    phase: "binding" | "derive" | "scheduler" | "hook";
};
export type ErrorHandler = (error: Error, context: ErrorContext) => void;
/** Register a global error handler (e.g. for Sentry/logging). Pass null to clear. */
export declare function setErrorHandler(fn: ErrorHandler | null): void;
export declare function reportError(error: Error, context: ErrorContext): void;
