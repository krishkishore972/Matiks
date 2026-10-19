/**
 * An error with an HTTP status.
 *
 * Anything thrown by a route that is not an `HttpError` is a bug, and the error
 * middleware reports it as a 500 without leaking a stack trace to the client.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
