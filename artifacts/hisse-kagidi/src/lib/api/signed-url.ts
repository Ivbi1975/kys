import { apiFetch, API_BASE } from "./core";

interface PhotoToken {
  token: string;
  expiresAt: number;
}

let cachedToken: PhotoToken | null = null;

export async function fetchPhotoToken(): Promise<PhotoToken> {
  if (cachedToken && cachedToken.expiresAt > Math.floor(Date.now() / 1000) + 60) {
    return cachedToken;
  }
  cachedToken = await apiFetch<PhotoToken>("/photo-token");
  return cachedToken;
}

export function getCachedPhotoToken(): PhotoToken | null {
  if (cachedToken && cachedToken.expiresAt > Math.floor(Date.now() / 1000) + 60) {
    return cachedToken;
  }
  return null;
}

export function buildSignedPhotoUrl(basePath: string, extraParams?: URLSearchParams): string {
  const params = extraParams ? new URLSearchParams(extraParams) : new URLSearchParams();
  const token = getCachedPhotoToken();
  if (token) {
    params.set("ptoken", token.token);
    params.set("exp", String(token.expiresAt));
  }
  const qs = params.toString();
  return qs ? `${API_BASE}${basePath}?${qs}` : `${API_BASE}${basePath}`;
}

export function clearPhotoTokenCache(): void {
  cachedToken = null;
}
