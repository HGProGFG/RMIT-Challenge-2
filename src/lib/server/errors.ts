export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable = false) {
    super(message);
  }
}
export function notReady(message = "Live Tide integration is not configured."): never {
  throw new AppError(503, "NOT_READY", message, true);
}
