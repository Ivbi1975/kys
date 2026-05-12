const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();

const sameOriginApiBase = import.meta.env.BASE_URL
  ? `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`
  : "/api";

export const API_BASE = (configuredApiBase || sameOriginApiBase).replace(/\/+$/, "");
