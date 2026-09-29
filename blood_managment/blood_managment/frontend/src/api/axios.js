import { supabase } from "../lib/supabase";
import { createApiClient } from "./client";

const baseURL = (import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

const api = createApiClient({ baseURL, getSession: () => supabase.auth.getSession() });

export default api;
