import crypto from "node:crypto";

const DEFAULT_TTL_SECONDS = 3600;

export function generatePhotoToken(secret: string, ttlSeconds = DEFAULT_TTL_SECONDS): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `photo-access\n${expiresAt}`;
  const token = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return { token, expiresAt };
}

export function verifyPhotoToken(token: string, exp: string, secret: string): { valid: boolean; reason?: string } {
  const expiresAt = parseInt(exp, 10);
  if (isNaN(expiresAt)) {
    return { valid: false, reason: "invalid_exp" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > expiresAt) {
    return { valid: false, reason: "expired" };
  }

  const payload = `photo-access\n${expiresAt}`;
  const expectedToken = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  if (!timingSafeCompare(token, expectedToken)) {
    return { valid: false, reason: "invalid_token" };
  }

  return { valid: true };
}

export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    const padded = Buffer.alloc(bufA.length);
    bufB.copy(padded, 0, 0, Math.min(bufB.length, bufA.length));
    crypto.timingSafeEqual(bufA, padded);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

const REQUEST_ID_REGEX = /^[a-zA-Z0-9._-]{1,128}$/;

export function sanitizeRequestId(value: string | undefined): string {
  if (value && REQUEST_ID_REGEX.test(value)) {
    return value;
  }
  return crypto.randomUUID();
}
