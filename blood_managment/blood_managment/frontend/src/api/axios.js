import { supabase } from "../lib/supabase";

const baseURL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

async function request(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${baseURL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return { data };
}

const api = {
  get: (url, config) => request(url, { method: "GET", ...config }),
  post: (url, data, config) => request(url, { method: "POST", body: JSON.stringify(data), ...config }),
  patch: (url, data, config) => request(url, { method: "PATCH", body: JSON.stringify(data), ...config }),
};

export default api;
