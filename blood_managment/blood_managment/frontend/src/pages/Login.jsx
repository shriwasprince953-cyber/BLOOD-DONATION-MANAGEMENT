import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import api from "../api/axios";
import { ensureProfile } from "../lib/account";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        setLoading(false);
        setError(loginError.message);
        return;
      }

      const res = await ensureProfile(api, data.user);

      if (res.data?.role === "ADMIN") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.warn("Unable to verify authenticated user profile:", err);
      setError(err.message || "Unable to verify your account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div className="brand-mark">🩸</div>

        <div>
          <h1>RaktSetu</h1>
          <p>Connecting blood. Saving lives.</p>
        </div>

        <div className="auth-quote">
          <span>“</span>
          <p>
            A small act from you could become someone's
            biggest reason to live.
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-heading">
            <span className="eyebrow">WELCOME BACK</span>

            <h2>Sign in to RaktSetu</h2>

            <p>
              Access your donor dashboard and help someone
              in need.
            </p>
          </div>

          <form onSubmit={handleLogin} className="auth-form">
            <div className="input-group">
              <label className="input-label" htmlFor="email">
                Email address
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

                <Link to="/forgot-password" className="forgot-password">
                  Forgot password?
                </Link>
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

            {location.state?.message && <p role="status">{location.state.message}</p>}
            {error && (
              <div className="auth-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="auth-divider">
            <span>New to RaktSetu?</span>
          </div>

          <Link to="/register" className="btn btn-secondary auth-register">
            Create donor account
          </Link>

          <div style={{ marginTop: "24px", textAlign: "center" }}>
            <Link to="/admin/login" style={{ color: "var(--text-muted)", fontSize: "12px", textDecoration: "none" }}>
              Admin Portal
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Login;
