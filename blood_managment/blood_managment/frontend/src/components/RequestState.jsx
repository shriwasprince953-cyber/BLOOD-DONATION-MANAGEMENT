import { Link } from "react-router-dom";

export default function RequestState({ error, retry, needsProfile }) {
  if (error) return <div role="alert" className="auth-error"><p>{error}</p>
    <button type="button" className="btn btn-secondary" onClick={retry}>Retry</button></div>;
  if (needsProfile) return <div className="card" style={{ padding: "20px" }}>
    <h3>Complete your donor profile</h3><p>Save your blood group in My Profile to see matching requests and appear in donor matches.</p>
    <Link to="/profile" className="btn btn-primary">Complete profile</Link></div>;
  return null;
}
