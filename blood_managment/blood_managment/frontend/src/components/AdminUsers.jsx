import { useEffect, useState } from "react";
import api from "../api/axios";
import Pagination from "./Pagination";

const accounts = { CONFIRMED: "Email verified", EMAIL_PENDING: "Email verification pending", AUTH_MISSING: "Login account missing" };
const profiles = { DONOR_REGISTERED: "Donor registered", PROFILE_ONLY: "Not registered as donor", SETUP_PENDING: "Profile setup pending" };

export default function AdminUsers({ refreshKey }) {
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, error: "", items: [], total: 0 });
  const limit = 20;
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setState({ loading: true, error: "", items: [], total: 0 }); });
    api.get(`/admin/users?limit=${limit}&offset=${offset}`).then(({ data }) => {
      if (!active) return;
      if (offset && offset >= data.total) { setOffset(0); return; }
      setState({ ...data, loading: false, error: "" });
    }).catch(error => {
      if (active) setState({ loading: false, error: error.message, items: [], total: 0 });
    });
    return () => { active = false; };
  }, [offset, attempt, refreshKey]);
  return <section className="card user-directory" aria-labelledby="users-heading">
    <div className="section-heading">
      <div><h2 id="users-heading">All registered users</h2><p>Includes accounts awaiting email verification or profile setup.</p></div>
      <button type="button" className="btn btn-secondary" disabled={state.loading} onClick={() => setAttempt(n => n + 1)}>Refresh users</button>
    </div>
    {state.loading ? <p role="status">Loading users…</p> : state.error ? <div role="alert">
      <p>{state.error}</p><button type="button" className="btn btn-secondary" onClick={() => setAttempt(n => n + 1)}>Retry users</button>
    </div> : <>
      {state.items.length === 0 ? <p>No registered users found.</p> : <div className="directory-scroll">
        <table className="directory-table"><thead><tr>
          <th>User</th><th>Role</th><th>Account / profile</th><th>Blood group</th><th>Availability</th><th>City</th>
        </tr></thead><tbody>{state.items.map(user => <tr key={user.id}>
          <td><strong>{user.full_name || "Name not provided"}</strong><br />{user.email || "Email not provided"}<br />{user.phone_number || "Phone not provided"}</td>
          <td>{user.role || "Not assigned"}</td>
          <td>{accounts[user.account_status]}<br />{profiles[user.profile_status]}</td>
          <td>{user.blood_group || "Not provided"}</td>
          <td>{user.is_available == null ? "Not a donor" : user.is_available ? "Available" : "Unavailable"}</td>
          <td>{user.city || "Not provided"}</td>
        </tr>)}</tbody></table>
      </div>}
      <Pagination offset={offset} limit={limit} total={state.total} onChange={setOffset} />
    </>}
  </section>;
}
