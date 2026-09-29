import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function PasswordRecovery({ reset = false }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (reset) {
        if (password !== confirmation) throw new Error("Passwords do not match.");
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session) throw new Error("This reset link is invalid or expired. Request a new one.");
        const result = await supabase.auth.updateUser({ password });
        if (result.error) throw result.error;
        await supabase.auth.signOut({ scope: "local" });
        navigate("/login", { replace: true, state: { message: "Password updated. Sign in with your new password." } });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage("If an account exists for this email, you will receive a password reset link.");
      }
    } catch (error) {
      setMessage(error.message || "Unable to reset your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  return <main className="auth-page"><section className="auth-panel"><div className="auth-card">
    <h1>{reset ? "Choose a new password" : "Reset your password"}</h1>
    <form className="auth-form" onSubmit={submit}>
      {reset ? <>
        <label htmlFor="new-password">New password</label>
        <input className="input" id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={event => setPassword(event.target.value)} />
        <label htmlFor="confirm-password">Confirm password</label>
        <input className="input" id="confirm-password" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
      </> : <>
        <label htmlFor="recovery-email">Email address</label>
        <input className="input" id="recovery-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
      </>}
      {message && <p role="status">{message}</p>}
      <button className="btn btn-primary" disabled={loading}>{loading ? "Please wait..." : reset ? "Update password" : "Send reset link"}</button>
    </form>
    <Link to={reset ? "/forgot-password" : "/login"}>{reset ? "Request a new reset link" : "Back to sign in"}</Link>
  </div></section></main>;
}
