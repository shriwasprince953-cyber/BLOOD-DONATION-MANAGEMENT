import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import api from "../api/axios";

function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data, error: registerError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (registerError) {
        setError(registerError.message);
        return;
      }

      if (data.session) {
        await api.post("/auth/register", {
          full_name: name,
          email,
        });
        navigate("/dashboard");
      } else {
        navigate("/login");
      }
    } catch (err) {
      console.warn("Unable to create account or application profile:", err);
      await supabase.auth.signOut();
      setError("Unable to complete account setup. Please try again.");
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
            Your blood can be someone's second chance.
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-heading">
            <span className="eyebrow">BECOME A DONOR</span>

            <h2>Create your account</h2>

            <p>
              Join RaktSetu and make a difference when it
              matters most.
            </p>
          </div>

          <form onSubmit={handleRegister} className="auth-form">
            <div className="input-group">
              <label className="input-label" htmlFor="name">
                Full name
              </label>

              <input
                id="name"
                type="text"
                className="input"
                placeholder="Your full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="email">
                Email address
              </label>

              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="password">
                Password
              </label>

              <input
                id="password"
                type="password"
                className="input"
                placeholder="Create a strong password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
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
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="auth-divider">
            <span>Already have an account?</span>
          </div>

          <Link to="/login" className="btn btn-secondary auth-register">
            Sign in instead
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Register;
