// errors.ts — central error reporting hook.
// Call sites keep their console output; reportError only notifies the handler.
let handler = null;
/** Register a global error handler (e.g. for Sentry/logging). Pass null to clear. */
export function setErrorHandler(fn) {
    handler = fn;
}
export function reportError(error, context) {
    if (!handler)
        return;
    try {
        handler(error, context);
    }
    catch {
        // Handler errors are swallowed — error reporting must never break the app.
    }
}
