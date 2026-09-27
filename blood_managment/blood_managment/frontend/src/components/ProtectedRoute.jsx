import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import api from "../api/axios";
import { supabase } from "../lib/supabase";

function ProtectedRoute({ children, requiredRole }) {
  const location = useLocation();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (active) setStatus("unauthenticated");
        return;
      }

      try {
        const { data: profile } = await api.get("/auth/me");
        if (active) {
          setStatus(profile.role === requiredRole ? "authorized" : "forbidden");
        }
      } catch (error) {
        console.warn("Unable to verify route access:", error);
        if (active) setStatus("unauthenticated");
      }
    }

    verifyAccess();
    return () => {
      active = false;
    };
  }, [requiredRole]);

  if (status === "checking") {
    return <div className="auth-page" aria-live="polite">Checking access…</div>;
  }

  if (status === "authorized") {
    return children;
  }

  if (status === "forbidden") {
    return <Navigate to={requiredRole === "ADMIN" ? "/dashboard" : "/admin"} replace />;
  }

  return <Navigate to={requiredRole === "ADMIN" ? "/admin/login" : "/login"} replace state={{ from: location }} />;
}

export default ProtectedRoute;
