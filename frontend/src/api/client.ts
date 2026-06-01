import axios from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  // Without a timeout a hung backend leaves every screen stuck on a loader forever.
  timeout: 15_000
});
