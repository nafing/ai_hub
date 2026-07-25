import axios from "axios";
import { Capacitor } from "@capacitor/core";

function resolveApiBaseUrl(): string {
  const absolute =
    import.meta.env.VITE_API_URL || import.meta.env.VITE_NATIVE_API_URL;
  if (absolute) return String(absolute).replace(/\/$/, "");

  // Capacitor has no Vite proxy — relative /v1/api hits the device, not your PC.
  if (Capacitor.isNativePlatform()) {
    console.warn(
      "[api] Set VITE_API_URL (e.g. http://192.168.0.208:5174/v1/api) for Capacitor",
    );
  }

  return (
    import.meta.env.SERVER_GLOBAL_PREFIX ||
    import.meta.env.VITE_API_PREFIX ||
    "/v1/api"
  );
}

const baseURL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});
