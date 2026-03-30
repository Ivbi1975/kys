const API_BASE = import.meta.env.BASE_URL
  ? `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/").replace(/\/$/, "")
  : "/api";

interface ApiError {
  error: string;
  details?: unknown;
}

export function getApiKey(): string {
  return sessionStorage.getItem("app_api_key") || "";
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const apiKey = getApiKey();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
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
      sessionStorage.removeItem("app_api_key");
      window.location.reload();
      throw new Error("Oturum süresi doldu. Yeniden giriş yapılıyor...");
    }
    const err: ApiError = await res.json().catch(() => ({ error: "Sunucu hatası" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export { API_BASE };
