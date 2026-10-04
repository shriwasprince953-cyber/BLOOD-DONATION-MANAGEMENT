import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import api from "../api/axios";
import { mapRequirement } from "../lib/requirements";
import AdminUsers from "../components/AdminUsers";
import Pagination from "../components/Pagination";

function Icon({ children }) {
  return <span className="dashboard-icon">{children}</span>;
}

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const urgencyLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function AdminDashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Admin User");
  const [userInitial, setUserInitial] = useState("A");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [requestOffset, setRequestOffset] = useState(0);
  const [requestTotal, setRequestTotal] = useState(0);
  const dashboardRun = useRef(0);
  const matchRun = useRef(0);

  // Stats
  const [stats, setStats] = useState({
    totalRequests: null,
    activeRequests: null,
    totalDonors: null,
  });

  // Requirements List
  const [requirements, setRequirements] = useState([]);

  // Selected Request for viewing matched donors
  const selectedReqRef = useRef(null);
  const [loadError, setLoadError] = useState("");
  const [selectedReqId, setSelectedReqId] = useState(null);
  const [matchedDonors, setMatchedDonors] = useState([]);
  const [loadingDonors, setLoadingDonors] = useState(false);
  const [donorError, setDonorError] = useState("");

  // Form State for creating requirement
  const [form, setForm] = useState({
    patientName: "",
    bloodGroup: "O-",
    unitsRequired: 2,
    urgencyLevel: "HIGH",
    hospitalName: "",
    location: "Nagpur, Maharashtra",
    notes: "",
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState({}); // { reqId: "Success msg" }
  const [message, setMessage] = useState({ type: "", text: "" });

  const loadDashboardData = useCallback(async (signal) => {
    if (signal?.aborted) return;
    const run = ++dashboardRun.current;
    setLoading(true);
    setLoadError("");
    try {
      const [requests, counts, profile] = await Promise.all([
        api.get(`/requirements?limit=20&offset=${requestOffset}`, { signal }), api.get("/admin/stats", { signal }), api.get("/auth/me", { signal }),
      ]);
      if (run !== dashboardRun.current || signal?.aborted) return;
      setUserName(profile.data.full_name);
      setUserInitial(profile.data.full_name.charAt(0).toUpperCase());
      setRequirements(requests.data.items.map(mapRequirement));
      setRequestTotal(requests.data.total);
      setStats(counts.data);
      setLoadError("");
    } catch (error) {
      if (run === dashboardRun.current && !signal?.aborted) setLoadError(error.message);
    } finally {
      if (run === dashboardRun.current && !signal?.aborted) setLoading(false);
    }
  }, [requestOffset]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      void loadDashboardData(controller.signal);
    });
    return () => controller.abort();
  }, [loadDashboardData, refreshKey]);

  // Ignore late responses when the administrator selects another request.
  const loadMatchedDonors = async (reqId) => {
    const run = ++matchRun.current;
    setLoadingDonors(true);
    setDonorError("");
    try {
      const { data } = await api.get(`/matching/requirements/${reqId}/donors`);
      if (selectedReqRef.current === reqId && run === matchRun.current) setMatchedDonors(data);
    } catch (error) {
      if (selectedReqRef.current === reqId && run === matchRun.current) {
        setMatchedDonors([]);
        setDonorError(error.message);
      }
    } finally {
      if (selectedReqRef.current === reqId && run === matchRun.current) setLoadingDonors(false);
    }
  };
  const handleViewMatchedDonors = async (reqId) => {
    const next = selectedReqRef.current === reqId ? null : reqId;
    selectedReqRef.current = next;
    setSelectedReqId(next);
    setMatchedDonors([]);
    setDonorError("");
    if (next) await loadMatchedDonors(next);
  };

  const handleNotifyDonors = async (reqId) => {
    setNotificationStatus(prev => ({ ...prev, [reqId]: "Queueing notifications..." }));
    try {
      const { data } = await api.post(`/matching/requirements/${reqId}/notify`);
      setNotificationStatus(prev => ({ ...prev,
        [reqId]: `Queued ${data.queued_notifications} in-app notifications. ${data.skipped_existing_notifications} already queued.`,
      }));
      if (selectedReqRef.current === reqId) await loadMatchedDonors(reqId);
    } catch (error) {
      setNotificationStatus(prev => ({ ...prev, [reqId]: error.message }));
    }
  };

  const handleUpdateStatus = async (reqId, newStatus) => {
    try {
      await api.patch(`/requirements/${reqId}`, { status: newStatus });
      await loadDashboardData();
    } catch (error) {
      setLoadError(error.message);
    }
  };

  // Handle Form Input Change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Submit new Requirement
  const handleCreateRequirement = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await api.post("/requirements", {
        patient_name: form.patientName,
        blood_group: form.bloodGroup,
        units_required: Number(form.unitsRequired),
        urgency_level: form.urgencyLevel,
        hospital_name: form.hospitalName,
        location: form.location,
        notes: form.notes,
      });

      if (res.data) {
        setMessage({ type: "success", text: "Blood requirement posted successfully!" });
        setForm({
          patientName: "",
          bloodGroup: "O-",
          unitsRequired: 2,
          urgencyLevel: "HIGH",
          hospitalName: "",
          location: "Nagpur, Maharashtra",
          notes: "",
        });
        loadDashboardData();
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Unable to post this request. Please retry." });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="dashboard-page">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">🩸</div>
          <div>
            <strong>RaktSetu</strong>
            <span>Admin Portal</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-label">ADMIN PANEL</span>

          <Link to="/admin" className="nav-item active">
            <Icon>⚙</Icon>
            Admin Dashboard
          </Link>

          <Link to="/admin/donor-view" className="nav-item">
            <Icon>♥</Icon>
            View as Donor
          </Link>

          <Link to="/profile" className="nav-item">
            <Icon>◉</Icon>
            My Profile
          </Link>
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">?</span>
            <div>
              <strong>Help & Support</strong>
              <p>System administrators contact</p>
            </div>
          </div>

          <button type="button" className="logout-button" onClick={handleLogout}>
            <span>↪</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Main */}
      <main className="dashboard-main">
        {/* Topbar */}
        <header className="dashboard-topbar">
          <div>
            <span className="mobile-brand">🩸 Admin Portal</span>
          </div>

          <div className="topbar-actions">
            <div className="user-menu">
              <div className="avatar">{userInitial}</div>
              <div className="user-info">
                <strong>{userName}</strong>
                <span>Administrator</span>
              </div>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          {loadError && <div role="alert" className="auth-error"><p>{loadError}</p>
            <button type="button" className="btn btn-secondary" onClick={() => setRefreshKey(n => n + 1)}>Retry dashboard</button></div>}
          {/* Heading */}
          <section className="requirements-heading animate-fade-in-up">
            <div>
              <span className="section-eyebrow">CRITICAL OPERATIONS</span>
              <h1>Admin Dashboard</h1>
              <p>Post emergency blood requirements, match registered donors, and dispatch alert notifications.</p>
            </div>
            <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => {
              selectedReqRef.current = null; setSelectedReqId(null); setRefreshKey(n => n + 1);
            }}>Refresh data</button>
          </section>

          <AdminUsers refreshKey={refreshKey} />

          {loading ? (
            <div style={{ display: "grid", placeItems: "center", padding: "80px 0" }}>
              <div className="spinner" style={{ borderTopColor: "var(--primary)" }}></div>
            </div>
          ) : loadError ? null : (
            <div className="animate-fade-in-up delay-1">
              {/* Stats Grid */}
              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon red">🩸</div>
                  <div>
                    <span>Total Requirements</span>
                    <strong>{stats.totalRequests ?? "—"}</strong>
                  </div>
                  <small>All request statuses</small>
                </div>

                <div className="stat-card">
                  <div className="stat-icon green">✓</div>
                  <div>
                    <span>Active Cases</span>
                    <strong>{stats.activeRequests ?? "—"}</strong>
                  </div>
                  <small>Requires immediate donors</small>
                </div>

                <div className="stat-card">
                  <div className="stat-icon orange">◉</div>
                  <div>
                    <span>Registered Donors</span>
                    <strong>{stats.totalDonors ?? "—"}</strong>
                  </div>
                  <small>Donor profiles saved</small>
                </div>
                <div className="stat-card"><div><span>Total Users</span><strong>{stats.totalUsers ?? "—"}</strong></div><small>Includes pending accounts</small></div>
                <div className="stat-card"><div><span>Available Donors</span><strong>{stats.availableDonors ?? "—"}</strong></div><small>Availability switched on</small></div>
              </section>

              {/* Main Workspace */}
              <div className="dashboard-grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: "24px", marginTop: "24px" }}>
                {/* Requirements List Panel */}
                <div className="requests-section">
                  <div className="section-heading">
                    <div>
                      <span className="section-eyebrow">ALL POSTS</span>
                      <h2>Blood Requirements Management</h2>
                    </div>
                  </div>

                  {requirements.length === 0 ? (
                    <div className="empty-requirements">
                      <div>🩸</div>
                      <h3>No blood requests posted</h3>
                      <p>Use the form on the right to post your first emergency request.</p>
                    </div>
                  ) : (
                    requirements.map((req, idx) => (
                      <article
                        key={req.id}
                        className={`request-card animate-fade-in-up`}
                        style={{ animationDelay: `${(idx + 1) * 0.05}s` }}
                      >
                        <div className="request-top">
                          <div className="blood-group">
                            <span>{req.bloodGroup}</span>
                          </div>
                          <div className="request-title">
                            <div>
                              <h3 style={{ fontSize: "16px", fontWeight: "700" }}>Blood for {req.patientName}</h3>
                              <span>Hospital: {req.hospital}</span>
                            </div>
                            <span className={`urgency-badge ${req.urgency === "CRITICAL" || req.urgency === "HIGH" ? "" : "normal-badge"}`} style={{ background: req.urgency === "CRITICAL" ? "var(--primary)" : req.urgency === "HIGH" ? "var(--warning)" : "#f1f1f1", color: req.urgency === "CRITICAL" || req.urgency === "HIGH" ? "white" : "#777" }}>
                              {req.urgency}
                            </span>
                          </div>
                        </div>

                        <div className="request-details" style={{ marginTop: "16px", gridTemplateColumns: "repeat(3, 1fr)" }}>
                          <div>
                            <span>📍</span>
                            <div>
                              <small>Location</small>
                              <strong>{req.location}</strong>
                            </div>
                          </div>
                          <div>
                            <span>◉</span>
                            <div>
                              <small>Units Needed</small>
                              <strong>{req.units} units</strong>
                            </div>
                          </div>
                          <div>
                            <span>⚙</span>
                            <div>
                              <small>Status</small>
                              <select
                                className="urgency-select"
                                style={{ minWidth: "90px", padding: "2px 5px", fontSize: "10px", height: "auto" }}
                                value={req.status}
                                onChange={(e) => handleUpdateStatus(req.id, e.target.value)}
                              >
                                <option value="OPEN">Open</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="FULFILLED">Fulfilled</option>
                                <option value="CANCELLED">Cancelled</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="request-action" style={{ display: "block", marginTop: "16px", background: "#fafafa", padding: "12px", borderRadius: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "11px", fontWeight: 600 }}>Notes: {req.notes}</span>
                            <button
                              type="button"
                              className="donate-button"
                              style={{ padding: "8px 12px", background: selectedReqId === req.id ? "#777" : "var(--primary)" }}
                              onClick={() => handleViewMatchedDonors(req.id)}
                            >
                              {selectedReqId === req.id ? "Hide Matches" : "Find Matches →"}
                            </button>
                          </div>

                          {/* Expanded Matched Donors Panel */}
                          {selectedReqId === req.id && (
                            <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                <h4 style={{ fontSize: "12px", fontWeight: "700" }}>Matched Donors ({req.bloodGroup})</h4>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  style={{ padding: "5px 10px", fontSize: "10px", borderRadius: "6px" }}
                                  onClick={() => handleNotifyDonors(req.id)}
                                  disabled={loadingDonors || Boolean(donorError) || !matchedDonors.length || !["OPEN", "IN_PROGRESS"].includes(req.status) || notificationStatus[req.id] === "Queueing notifications..."}
                                >
                                  Notify Matched Donors ✉
                                </button>
                              </div>

                              {notificationStatus[req.id] && (
                                <div role="status" style={{ fontSize: "11px", fontWeight: 600, marginBottom: "8px" }}>
                                  {notificationStatus[req.id]}
                                </div>
                              )}

                              <p>Exact blood group, availability on. All cities; no distance filter.</p>
                              {loadingDonors ? (
                                <div style={{ display: "grid", placeItems: "center", padding: "12px" }}>
                                  <div className="spinner" style={{ borderTopColor: "var(--primary)" }}></div>
                                </div>
                              ) : donorError ? (
                                <div role="alert"><p>{donorError}</p><button type="button" className="btn btn-secondary" onClick={() => loadMatchedDonors(req.id)}>Retry matches</button></div>
                              ) : matchedDonors.length === 0 ? (
                                <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>No available donors registered with blood group {req.bloodGroup}.</p>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {matchedDonors.map((d) => (
                                    <div key={d.profile_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "11px" }}>
                                      <div>
                                        <strong>{d.full_name}</strong> ({d.blood_group}) - {d.city || "City not provided"}
                                        <div style={{ color: "var(--text-secondary)", fontSize: "10px" }}>{d.phone_number || "Phone not provided"} | {d.email}</div>
                                      </div>
                                      <div style={{ textAlign: "right" }}>
                                        <span className={`badge ${d.already_notified ? "badge-success" : "badge-warning"}`} style={{ display: "inline-block", fontSize: "8px", padding: "2px 5px", margin: "2px" }}>
                                          {d.already_notified ? "Queued" : "Not Queued"}
                                        </span>
                                        {d.response_status && (
                                          <span className="badge badge-danger" style={{ display: "inline-block", fontSize: "8px", padding: "2px 5px", margin: "2px", background: "var(--primary-light)", color: "var(--primary)" }}>
                                            Response: {d.response_status}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                  <Pagination offset={requestOffset} limit={20} total={requestTotal} onChange={value => {
                    selectedReqRef.current = null; setSelectedReqId(null); setRequestOffset(value);
                  }} />
                </div>

                {/* Form Panel */}
                <aside className="profile-progress-card animate-fade-in-up" style={{ alignSelf: "start" }}>
                  <h3 style={{ fontSize: "18px", fontWeight: "700" }}>Post Emergency Blood Request</h3>
                  <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                    Post a request, then use Find Matches to view available donors with the exact blood group across all cities.
                  </p>

                  <form onSubmit={handleCreateRequirement} className="auth-form" style={{ marginTop: "20px", gap: "16px" }}>
                    {/* Patient Name */}
                    <div className="input-group">
                      <label className="input-label" htmlFor="patientName">Patient Name</label>
                      <input
                        id="patientName"
                        name="patientName"
                        type="text"
                        className="input"
                        placeholder="e.g. Ramesh Deshmukh"
                        value={form.patientName}
                        onChange={handleFormChange}
                        required
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      {/* Blood Group */}
                      <div className="input-group">
                        <label className="input-label" htmlFor="bloodGroup">Blood Group Required</label>
                        <select
                          id="bloodGroup"
                          name="bloodGroup"
                          className="urgency-select"
                          style={{ width: "100%", height: "46px" }}
                          value={form.bloodGroup}
                          onChange={handleFormChange}
                        >
                          {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                        </select>
                      </div>

                      {/* Required Units */}
                      <div className="input-group">
                        <label className="input-label" htmlFor="unitsRequired">Units Required</label>
                        <input
                          id="unitsRequired"
                          name="unitsRequired"
                          type="number"
                          min="1"
                          max="20"
                          className="input"
                          value={form.unitsRequired}
                          onChange={handleFormChange}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      {/* Urgency Level */}
                      <div className="input-group">
                        <label className="input-label" htmlFor="urgencyLevel">Urgency Level</label>
                        <select
                          id="urgencyLevel"
                          name="urgencyLevel"
                          className="urgency-select"
                          style={{ width: "100%", height: "46px" }}
                          value={form.urgencyLevel}
                          onChange={handleFormChange}
                        >
                          {urgencyLevels.map(ul => <option key={ul} value={ul}>{ul}</option>)}
                        </select>
                      </div>

                      {/* Location */}
                      <div className="input-group">
                        <label className="input-label" htmlFor="location">City / Location</label>
                        <input
                          id="location"
                          name="location"
                          type="text"
                          className="input"
                          value={form.location}
                          onChange={handleFormChange}
                          required
                        />
                      </div>
                    </div>

                    {/* Hospital Name */}
                    <div className="input-group">
                      <label className="input-label" htmlFor="hospitalName">Hospital Name</label>
                      <input
                        id="hospitalName"
                        name="hospitalName"
                        type="text"
                        className="input"
                        placeholder="e.g. City Care Hospital"
                        value={form.hospitalName}
                        onChange={handleFormChange}
                        required
                      />
                    </div>

                    {/* Notes */}
                    <div className="input-group">
                      <label className="input-label" htmlFor="notes">Notes / Special Instructions</label>
                      <textarea
                        id="notes"
                        name="notes"
                        className="input"
                        style={{ minHeight: "80px", resize: "vertical" }}
                        placeholder="Write details like bypass surgery, platelet drop info..."
                        value={form.notes}
                        onChange={handleFormChange}
                      />
                    </div>

                    {message.text && (
                      <div className={`auth-error ${message.type === "success" ? "badge-success" : ""}`} style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", border: "1px solid var(--border)", background: message.type === "success" ? "#eaf8f2" : "#fff3f5" }}>
                        {message.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: "100%", padding: "14px" }}
                      disabled={formSubmitting}
                    >
                      {formSubmitting ? "Posting..." : "Post Request →"}
                    </button>
                  </form>
                </aside>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="mobile-nav-bar">
        <Link to="/admin" className="mobile-nav-item active">
          <span>⚙</span>
          Admin
        </Link>
        <Link to="/admin/donor-view" className="mobile-nav-item">
          <span>♥</span>
          Requests
        </Link>
        <Link to="/profile" className="mobile-nav-item">
          <span>◉</span>
          Profile
        </Link>
      </nav>
    </div>
  );
}

export default AdminDashboard;
