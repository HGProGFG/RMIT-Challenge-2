import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ApiError, ApiSuccess, Identity, Role } from "../contracts";
import { claimRate } from "../db";
import { actorBucket, authenticate } from "./auth";
import { appOrigin } from "./config";
import { AppError } from "./errors";

export type ApiContext = { actor: Identity; correlationId: string };
export function requireRoles(actor: Identity, roles: Role[]) {
  if (!roles.some(role => actor.roles.includes(role))) throw new AppError(403, "FORBIDDEN", "This verified role cannot perform the operation.");
}
export function idempotencyKey(req: Request) {
  const key = req.headers.get("idempotency-key") ?? "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw new AppError(422, "INVALID_IDEMPOTENCY_KEY", "Provide an Idempotency-Key of 16–128 letters, digits, underscores or hyphens.");
  return key;
}
export function decodeBase64(value: string, max: number) {
  if (value.length > 4 * Math.ceil(max / 3)) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Encoded bytes exceed the configured limit.");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new AppError(422, "INVALID_BASE64", "Use canonical padded base64 encoding.");
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > max) throw new AppError(bytes.length ? 413 : 422, "INVALID_BYTE_LENGTH", "Byte length is outside the permitted range.");
  if (bytes.toString("base64") !== value) throw new AppError(422, "INVALID_BASE64", "Use canonical base64 encoding.");
  return bytes;
}
export async function readBody<T>(req: Request, schema: z.ZodType<T>, max = 24 * 1024): Promise<T> {
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AppError(422, "JSON_REQUIRED", "Content-Type must be application/json.");
  const length = req.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > max)) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request exceeds the allowed size.");
  const reader = req.body?.getReader();
  if (!reader) throw new AppError(422, "INVALID_INPUT", "JSON body is required.");
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      total += value.length;
      if (total > max) { await reader.cancel(); throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request exceeds the allowed size."); }
      chunks.push(value);
    }
    return schema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(422, "INVALID_INPUT", "Request JSON does not match the strict application schema.");
  } finally { reader.releaseLock(); }
}
export function pagination(url: URL) {
  const parse = (key: string, fallback: number, max: number) => {
    const v = url.searchParams.get(key);
    if (v === null) return fallback;
    if (!/^\d+$/.test(v) || Number(v) > max || (key === "limit" && Number(v) < 1)) throw new AppError(422, "INVALID_PAGINATION", "Invalid pagination parameters.");
    return Number(v);
  };
  return { limit: parse("limit", 50, 100), offset: parse("offset", 0, 1000000) };
}
export function json<T>(data: T, correlationId: string, status = 200) {
  return Response.json({ data, correlationId, version: 1 } satisfies ApiSuccess<T>, { status });
}
export async function protectedRoute(req: Request, handler: (ctx: ApiContext) => Promise<Response>) {
  const correlationId = randomUUID(); let response: Response;
  try {
    const actor = await authenticate(req);
    if (!claimRate(actorBucket(actor), 120)) throw new AppError(429, "RATE_LIMITED", "Too many requests. Retry in one minute.", true);
    if (!["GET", "HEAD"].includes(req.method)) {
      if (req.headers.get("origin") !== appOrigin() || req.headers.get("sec-fetch-site") === "cross-site") throw new AppError(403, "ORIGIN_REJECTED", "Mutations require the configured same origin.");
      if (!claimRate(`${actorBucket(actor)}:mutation`, 30)) throw new AppError(429, "RATE_LIMITED", "Too many mutations. Retry in one minute.", true);
    }
    response = await handler({ actor, correlationId });
  } catch (error) {
    const known = error instanceof AppError ? error : new AppError(503, "SERVICE_UNAVAILABLE", "The operation could not be verified.", true);
    response = Response.json({ error: { code: known.code, message: known.message, correlationId, retryable: known.retryable } } satisfies ApiError, { status: known.status });
  }
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Correlation-ID", correlationId);
  response.headers.set("Vary", "Authorization, DPoP, Origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (response.status === 401) response.headers.set("WWW-Authenticate", 'DPoP error="invalid_token"');
  if (response.status === 429) response.headers.set("Retry-After", "60");
  return response;
}
