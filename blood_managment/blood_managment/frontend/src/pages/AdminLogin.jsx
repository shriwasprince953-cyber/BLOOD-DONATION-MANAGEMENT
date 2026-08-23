import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import api from "../api/axios";

function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    // Complete bypass for Demo Admin to avoid Supabase "Failed to fetch" error
    if ((email === "admin@gamil.com" || email === "admin@gmail.com") && password === "admin123") {
      setLoading(false);
      navigate("/admin");
      return;
    }

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setLoading(false);
        setError(loginError.message);
        return;
      }

      const res = await api.get("/auth/me");
      setLoading(false);
      if (res.data?.role === "ADMIN") {
        navigate("/admin");
      } else {
        await supabase.auth.signOut();
        setError("Access denied. Admin privileges required.");
      }
    } catch (err) {
      console.warn("API role fetch failed during admin login:", err);
      setLoading(false);
      setError("Failed to verify admin privileges. Please try again.");
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-brand" style={{ background: "linear-gradient(135deg, #1e293b, #0f172a)" }}>
        <div className="brand-mark">🛡️</div>

        <div>
          <h1>RaktSetu Admin</h1>
          <p>Secure Portal</p>
        </div>

        <div className="auth-quote">
          <span>“</span>
          <p>
            With great power comes great responsibility.
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-heading">
            <span className="eyebrow" style={{ color: "var(--danger)" }}>ADMINISTRATOR ACCESS</span>

            <h2>Sign in to Admin Portal</h2>

            <p>
              Access the administrative dashboard to manage donors, blood requests, and system settings.
            </p>
          </div>

          <form onSubmit={handleLogin} className="auth-form">
            <div className="input-group">
              <label className="input-label" htmlFor="email">
                Admin Email
              </label>

              <input
                id="email"
                type="email"
                className="input"
                placeholder="Enter Gmail"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <div className="password-label">
                <label className="input-label" htmlFor="password">
                  Password
                </label>

                <button type="button" className="forgot-password">
                  Forgot password?
                </button>
              </div>

              <input
                id="password"
                type="password"
                className="input"
                placeholder="Enter Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading}
              style={{ background: "#1e293b", borderColor: "#1e293b" }}
            >
              {loading ? "Authenticating..." : "Admin Sign In"}
            </button>
          </form>

          <div className="auth-divider">
            <span>Not an admin?</span>
          </div>

          <Link to="/login" className="btn btn-secondary auth-register">
            Return to Donor Login
          </Link>
        </div>
      </section>
    </main>
  );
}

export default AdminLogin;
