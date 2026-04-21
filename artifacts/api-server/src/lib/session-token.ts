import crypto from "node:crypto";
import { timingSafeCompare } from "./signed-url";

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;
const TOKEN_VERSION = "s1";
const PAYLOAD_LABEL = "session";

export interface SessionTokenResult {
  token: string;
  expiresAt: number;
}

export function issueSessionToken(secret: string, ttlSeconds = DEFAULT_SESSION_TTL_SECONDS): SessionTokenResult {
  if (!secret) throw new Error("Session secret is required");
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${PAYLOAD_LABEL}\n${expiresAt}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return { token: `${TOKEN_VERSION}.${expiresAt}.${sig}`, expiresAt };
}

export function verifySessionToken(token: string, secret: string): { valid: boolean; reason?: string } {
  if (!secret) return { valid: false, reason: "missing_secret" };
  if (typeof token !== "string" || !token) return { valid: false, reason: "missing_token" };
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, reason: "invalid_format" };
  const [version, expStr, sig] = parts;
  if (version !== TOKEN_VERSION) return { valid: false, reason: "unsupported_version" };
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp)) return { valid: false, reason: "invalid_exp" };
  const now = Math.floor(Date.now() / 1000);
  if (now > exp) return { valid: false, reason: "expired" };
  const payload = `${PAYLOAD_LABEL}\n${exp}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (!timingSafeCompare(sig, expected)) return { valid: false, reason: "invalid_signature" };
  return { valid: true };
}

export function isSessionTokenShape(token: string): boolean {
  return typeof token === "string" && token.startsWith(`${TOKEN_VERSION}.`);
}
