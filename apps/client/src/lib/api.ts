import axios from "axios";

const baseURL =
  import.meta.env.SERVER_GLOBAL_PREFIX ||
  import.meta.env.VITE_API_PREFIX ||
  "/v1/api";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});
