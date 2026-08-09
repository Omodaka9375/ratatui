// errors.ts — central error reporting hook.
// Call sites keep their console output; reportError only notifies the handler.

export type ErrorContext = {
  label: string;
  phase: "binding" | "derive" | "scheduler" | "hook";
};

export type ErrorHandler = (error: Error, context: ErrorContext) => void;

let handler: ErrorHandler | null = null;

/** Register a global error handler (e.g. for Sentry/logging). Pass null to clear. */
export function setErrorHandler(fn: ErrorHandler | null): void {
  handler = fn;
}

export function reportError(error: Error, context: ErrorContext): void {
  if (!handler) return;
  try {
    handler(error, context);
  } catch {
    // Handler errors are swallowed — error reporting must never break the app.
  }
}
