export function createApiClient({ baseURL, getSession, fetcher = globalThis.fetch }) {
  const base = baseURL.replace(/\/+$/, "");
  async function request(path, options = {}) {
    const { data: { session }, error: sessionError } = await getSession();
    if (sessionError) throw sessionError;
    const headers = { ...options.headers };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    let response;
    try {
      response = await fetcher(`${base}${path}`, {
        ...options, headers, signal: options.signal || AbortSignal.timeout(15000),
      });
    } catch (cause) {
      throw new Error("Unable to reach the server. Check your connection and try again.", { cause });
    }
    const body = await response.text();
    let data;
    try { data = body ? JSON.parse(body) : null; } catch {
      throw new Error("The server returned an unexpected response. Please try again.");
    }
    if (!response.ok) {
      const detail = data?.detail;
      const message = typeof detail === "string" ? detail : Array.isArray(detail)
        ? detail.map(item => `${item.loc?.slice(1).join(".") || "Input"}: ${item.msg}`).join("; ")
        : `Request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return { data };
  }
  return {
    get: (url, config) => request(url, { method: "GET", ...config }),
    post: (url, data, config) => request(url, { method: "POST", body: JSON.stringify(data), ...config }),
    patch: (url, data, config) => request(url, { method: "PATCH", body: JSON.stringify(data), ...config }),
  };
}
