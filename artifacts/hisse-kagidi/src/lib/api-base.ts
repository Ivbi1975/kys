const sameOriginApiBase = import.meta.env.BASE_URL
  ? `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`
  : "/api";

// In dev, always use same-origin path so Vite proxy handles the request
// (avoids CORS issues with the external API server).
// In production builds, use the configured external URL.
export const API_BASE = (
  import.meta.env.DEV
    ? sameOriginApiBase
    : (import.meta.env.VITE_API_BASE_URL?.trim() || sameOriginApiBase)
).replace(/\/+$/, "");
