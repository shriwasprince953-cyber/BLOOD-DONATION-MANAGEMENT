import { useEffect, useState } from "react";
import api from "../api/axios";
import { mapRequirement } from "../lib/requirements";

export default function useRequests({ preview = false, group = "All", urgency = "All", offset = 0, limit = 20 } = {}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, error: "", profile: null, requirements: [], total: null });
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setState({ loading: true, error: "", profile: null, requirements: [], total: null }); });
    async function load() {
      try {
        const { data: profile } = await api.get("/auth/me");
        if (!active) return;
        if (!preview && !profile.donor) {
          setState({ loading: false, error: "", profile, requirements: [], total: null });
          return;
        }
        const query = new URLSearchParams({ limit, offset });
        if (urgency !== "All") query.set("urgency", urgency);
        if (preview) {
          query.set("active_only", "true");
          if (group !== "All") query.set("blood_group", group);
        }
        const { data } = await api.get(`${preview ? "/requirements" : "/donors/me/requirements/page"}?${query}`);
        if (active) setState({ loading: false, error: "", profile, requirements: data.items.map(mapRequirement), total: data.total });
      } catch (error) {
        if (active) setState({ loading: false, error: error.message, profile: null, requirements: [], total: null });
      }
    }
    void load();
    return () => { active = false; };
  }, [preview, group, urgency, offset, limit, attempt]);
  return { ...state, retry: () => setAttempt(n => n + 1) };
}
