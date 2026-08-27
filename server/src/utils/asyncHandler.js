/** Express 4 doesn't catch rejected promises from async route handlers on its own —
 * an unhandled rejection just leaves the request hanging until the client times out.
 * Wrap every async handler with this so errors actually reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
