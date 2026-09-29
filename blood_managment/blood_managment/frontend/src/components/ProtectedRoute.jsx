import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import api from "../api/axios";
import { supabase } from "../lib/supabase";

function ProtectedRoute({ children, requiredRole }) {
  const location = useLocation();
  const [status, setStatus] = useState("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) {
          if (active) setStatus("unauthenticated");
          return;
        }
        const { data: profile } = await api.get("/auth/me");
        if (active) {
          setStatus(["ADMIN", "DONOR"].includes(profile.role)
            ? (!requiredRole || profile.role === requiredRole ? "authorized" : "forbidden")
            : "error");
        }
      } catch (error) {
        console.warn("Unable to verify route access:", error);
        if (active) setStatus([401, 403].includes(error.status) ? "unauthenticated" : "error");
      }
    }

    verifyAccess();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && active) {
        setStatus("unauthenticated");
        active = false;
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [requiredRole, attempt]);

  if (status === "error") {
    return <main className="auth-page"><div role="alert">
      <p>Unable to verify account access. Please check your connection and retry.</p>
      <button className="btn btn-primary" onClick={() => { setStatus("checking"); setAttempt(value => value + 1); }}>Retry</button>
    </div></main>;
  }

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
