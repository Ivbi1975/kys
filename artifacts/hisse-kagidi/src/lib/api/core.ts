import { API_BASE } from "@/lib/api-base";

interface ApiError {
  error: string;
  details?: unknown;
}

export class ApiFetchError extends Error {
  details?: Array<{ path?: (string | number)[]; message?: string }>;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "ApiFetchError";
    if (Array.isArray(details)) {
      this.details = details;
    }
  }
}

export function getApiKey(): string {
  return sessionStorage.getItem("app_session_token") || "";
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      sessionStorage.removeItem("app_unlocked");
      sessionStorage.removeItem("app_session_token");
      window.location.reload();
      throw new Error("Oturum süresi doldu. Yeniden giriş yapılıyor...");
    }
    if (res.status === 413) {
      throw new ApiFetchError("Gönderilen veri çok büyük. Lütfen daha az kayıt ile tekrar deneyin veya sayfayı yenileyip tekrar kaydedin.");
    }
    const err: ApiError = await res.json().catch(() => ({ error: "Sunucu hatası" }));
    throw new ApiFetchError(err.error || `HTTP ${res.status}`, err.details);
  }
  return res.json() as Promise<T>;
}

export { API_BASE };
