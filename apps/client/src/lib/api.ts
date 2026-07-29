import axios, { AxiosHeaders } from "axios";
import { Capacitor } from "@capacitor/core";

const API_BASE_STORAGE_KEY = "ai_hub_api_base";

function apiPrefix(): string {
  return (
    import.meta.env.SERVER_GLOBAL_PREFIX ||
    import.meta.env.VITE_API_PREFIX ||
    "/v1/api"
  );
}

function withPrefix(origin: string): string {
  const prefix = apiPrefix();
  const path = prefix.startsWith("/") ? prefix : `/${prefix}`;
  return `${origin.replace(/\/$/, "")}${path}`;
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

/** Private LAN / link-local hosts (not public internet). */
function isLanHost(hostname: string): boolean {
  if (isLoopbackHost(hostname)) return false;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  // Capacitor live-reload sometimes uses the machine hostname on LAN.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*$/i.test(hostname) && hostname.includes(".")) {
    return true;
  }
  return false;
}

function readStoredApiBase(): string | null {
  try {
    const value = localStorage.getItem(API_BASE_STORAGE_KEY);
    return value?.trim() ? value.trim().replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

function resolveApiBaseUrl(): string {
  const stored = readStoredApiBase();
  if (stored) return stored;

  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl?.trim()) return envUrl.trim().replace(/\/$/, "");

  // Native WebView has no Vite proxy — need an absolute API URL.
  if (Capacitor.isNativePlatform()) {
    const hostname = window.location.hostname;
    const apiPort = import.meta.env.VITE_API_PORT || "5174";

    // Live-reload / external URL on LAN → hit API on the same host.
    if (hostname && isLanHost(hostname)) {
      return withPrefix(`http://${hostname}:${apiPort}`);
    }

    // Android emulator → host machine loopback
    if (Capacitor.getPlatform() === "android") {
      return withPrefix(`http://10.0.2.2:${apiPort}`);
    }

    return withPrefix(`http://127.0.0.1:${apiPort}`);
  }

  return apiPrefix();
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

/** Persist and apply API base (e.g. http://192.168.1.10:5174/v1/api). */
export function setApiBaseUrl(url: string): void {
  const next = url.trim().replace(/\/$/, "");
  localStorage.setItem(API_BASE_STORAGE_KEY, next);
  api.defaults.baseURL = next;
}

export function clearApiBaseUrl(): void {
  localStorage.removeItem(API_BASE_STORAGE_KEY);
  api.defaults.baseURL = resolveApiBaseUrl();
}

export function getApiBaseUrl(): string {
  return String(api.defaults.baseURL ?? "");
}

// Let the runtime set multipart boundary. Axios `Content-Type: false` is
// unreliable across adapters and ends up as an invalid media type (415).
api.interceptors.request.use((config) => {
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    const headers = AxiosHeaders.from(config.headers ?? {});
    headers.delete("Content-Type");
    headers.delete("content-type");
    config.headers = headers;
  }
  return config;
});
