import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import api from "../api/axios";

function Icon({ children }) {
  return <span className="dashboard-icon">{children}</span>;
}

const mockRequirements = [
  {
    id: "1",
    bloodGroup: "O-",
    title: "Urgent blood requirement",
    hospital: "City Care Hospital",
    location: "Nagpur, Maharashtra",
    units: 3,
    urgency: "URGENT",
    posted: "18 minutes ago",
    distance: "3.2 km",
    patientName: "Rajesh Kumar",
    notes: "Patient is undergoing urgent bypass surgery. Any O- donor in the area is requested to reach out immediately.",
  },
  {
    id: "2",
    bloodGroup: "A+",
    title: "Blood donation needed",
    hospital: "Orange City Hospital",
    location: "Nagpur, Maharashtra",
    units: 2,
    urgency: "NORMAL",
    posted: "1 hour ago",
    distance: "5.8 km",
    patientName: "Aarti Sharma",
    notes: "Needed for scheduled minor operation. Replacement donor requested.",
  },
  {
    id: "3",
    bloodGroup: "B+",
    title: "Immediate blood requirement",
    hospital: "Wockhardt Hospital",
    location: "Nagpur, Maharashtra",
    units: 4,
    urgency: "HIGH",
    posted: "2 hours ago",
    distance: "7.1 km",
    patientName: "Amit Patel",
    notes: "Requires multiple transfusions due to sudden drop in platelet count. Immediate support is highly appreciated.",
  },
  {
    id: "4",
    bloodGroup: "AB+",
    title: "Blood required for surgery",
    hospital: "Alexis Hospital",
    location: "Nagpur, Maharashtra",
    units: 2,
    urgency: "HIGH",
    posted: "3 hours ago",
    distance: "8.4 km",
    patientName: "Sushma Deshmukh",
    notes: "Patient is scheduled for orthopedic surgery. Please contact.",
  },
  {
    id: "5",
    bloodGroup: "O+",
    title: "Blood donation request",
    hospital: "SevenStar Hospital",
    location: "Nagpur, Maharashtra",
    units: 1,
    urgency: "NORMAL",
    posted: "5 hours ago",
    distance: "10.2 km",
    patientName: "Vikram Singh",
    notes: "General replacement donation request for thalassaemia patient's monthly transfusion.",
  },
];

function RequirementDetail() {
  const { id } = useParams();

  const [requirement, setRequirement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responseStatus, setResponseStatus] = useState(null); // 'PENDING', 'ACCEPTED', etc.
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [userInitial, setUserInitial] = useState("U");
  const [userName, setUserName] = useState("Prince");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // Get user session info
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const user = session.user;
          const initial = user.user_metadata?.full_name
            ? user.user_metadata.full_name.charAt(0).toUpperCase()
            : user.email.charAt(0).toUpperCase();
          setUserInitial(initial);
          setUserName(user.user_metadata?.full_name || localStorage.getItem("temp_fullName") || "Prince");
        }

        // Try getting real requirement from API
        try {
          const res = await api.get(`/requirements/${id}`);
          if (res.data) {
            setRequirement({
              id: res.data.id,
              bloodGroup: res.data.blood_group,
              title: `Blood Requirement for ${res.data.patient_name}`,
              hospital: res.data.hospital_name,
              location: res.data.location,
              units: res.data.units_required,
              urgency: res.data.urgency_level,
              posted: "Just now",
              distance: "Nearby",
              patientName: res.data.patient_name,
              notes: res.data.notes || "No special instructions provided.",
              status: res.data.status,
            });
          }
        } catch (apiErr) {
          console.warn("API error fetching requirement details. Falling back to mock data.", apiErr);
          // Find in mock data
          const found = mockRequirements.find((item) => String(item.id) === String(id));
          if (found) {
            setRequirement(found);
          } else {
            // Check local storage items if any
            const savedReqs = JSON.parse(localStorage.getItem("temp_requirements") || "[]");
            const localFound = savedReqs.find((item) => String(item.id) === String(id));
            if (localFound) {
              setRequirement(localFound);
            }
          }
        }

        // Check if user already responded to this request
        try {
          const res = await api.get("/responses/me");
          const existing = res.data.items?.find((r) => String(r.requirement_id) === String(id));
          if (existing) {
            setResponseStatus(existing.status);
          }
        } catch {
          // Local fallback check
          const localResponses = JSON.parse(localStorage.getItem("temp_responses") || "{}");
          if (localResponses[id]) {
            setResponseStatus(localResponses[id]);
          }
        }
      } catch (err) {
        console.error("Error loading details:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const handleDonate = async () => {
    setSubmitting(true);
    setMessage({ type: "", text: "" });
    try {
      // POST response to backend
      const res = await api.post("/responses", { requirement_id: id });
      setResponseStatus(res.data.status || "PENDING");
      setMessage({ type: "success", text: "Thank you! Your donation request has been submitted." });
    } catch (err) {
      console.warn("API response failed, saving donation response locally:", err);
      // Simulate success locally
      const localResponses = JSON.parse(localStorage.getItem("temp_responses") || "{}");
      localResponses[id] = "PENDING";
      localStorage.setItem("temp_responses", JSON.stringify(localResponses));
      setResponseStatus("PENDING");
      setMessage({
        type: "success",
        text: "Thank you! Your donation response has been registered locally (Offline mode).",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="dashboard-page" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div className="spinner" style={{ borderTopColor: "var(--primary)" }}></div>
      </div>
    );
  }

  if (!requirement) {
    return (
      <div className="dashboard-page" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          <h2>Request Not Found</h2>
          <p style={{ marginTop: "10px", color: "var(--text-secondary)" }}>The blood request details could not be loaded.</p>
          <Link to="/requirements" className="btn btn-primary" style={{ marginTop: "20px" }}>
            Back to Requests
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">🩸</div>
          <div>
            <strong>RaktSetu</strong>
            <span>Donor Network</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-label">MENU</span>

          <Link to="/dashboard" className="nav-item">
            <Icon>⌂</Icon>
            Dashboard
          </Link>

          <Link to="/requirements" className="nav-item active">
            <Icon>♥</Icon>
            Blood Requests
          </Link>

          <Link to="/profile" className="nav-item">
            <Icon>◉</Icon>
            My Profile
          </Link>

          <span className="nav-label nav-label-space">ACCOUNT</span>

          <button type="button" className="nav-item nav-button" onClick={() => setMessage({ type: "success", text: "Settings saved." })}>
            <Icon>⚙</Icon>
            Settings
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">?</span>
            <div>
              <strong>Need help?</strong>
              <p>We're here for you.</p>
            </div>
          </div>

          <button type="button" className="logout-button" onClick={handleLogout}>
            <span>↪</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="dashboard-main">
        {/* Topbar */}
        <header className="dashboard-topbar">
          <div>
            <span className="mobile-brand">🩸 RaktSetu</span>
          </div>

          <div className="topbar-actions">
            <button type="button" className="notification-button">
              <span>♢</span>
              <i />
            </button>

            <div className="user-menu">
              <div className="avatar">{userInitial}</div>
              <div className="user-info">
                <strong>{userName}</strong>
                <span>Donor</span>
              </div>
              <span className="chevron">⌄</span>
            </div>
          </div>
        </header>

        <div className="dashboard-content animate-fade-in-up">
          <section className="requirements-heading" style={{ marginBottom: "20px" }}>
            <div>
              <span className="section-eyebrow">DETAILED VIEW</span>
              <h1>Request Details</h1>
              <p>Review the patient information and confirm if you are able to donate.</p>
            </div>
            <Link to="/requirements" className="btn btn-secondary" style={{ padding: "10px 16px", borderRadius: "10px" }}>
              ← Back
            </Link>
          </section>

          <div className="dashboard-grid">
            <div className="requests-section">
              <article className="card" style={{ padding: "32px", marginBottom: "24px" }}>
                <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                  <div className="large-blood-group" style={{ width: "84px", height: "84px", fontSize: "28px" }}>
                    {requirement.bloodGroup}
                  </div>
                  <div>
                    <h2 style={{ fontSize: "24px", fontWeight: "700" }}>{requirement.title}</h2>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "8px" }}>
                      <span className={`urgency-label ${requirement.urgency.toLowerCase()}`}>
                        {requirement.urgency}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        Posted {requirement.posted}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="large-details" style={{ marginTop: "32px" }}>
                  <div>
                    <span style={{ fontSize: "20px" }}>🏥</span>
                    <div>
                      <small>Hospital</small>
                      <strong>{requirement.hospital}</strong>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: "20px" }}>📍</span>
                    <div>
                      <small>Location</small>
                      <strong>{requirement.location}</strong>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: "20px" }}>◉</span>
                    <div>
                      <small>Blood Required</small>
                      <strong>{requirement.units} units</strong>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-secondary)" }}>Patient Name</h4>
                  <p style={{ marginTop: "8px", fontWeight: 600, fontSize: "16px" }}>{requirement.patientName}</p>
                </div>

                <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-secondary)" }}>Notes & Instructions</h4>
                  <p style={{ marginTop: "8px", fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>{requirement.notes}</p>
                </div>
              </article>
            </div>

            <aside className="profile-progress-card">
              <h3 style={{ fontSize: "18px", fontWeight: "700" }}>Respond to Request</h3>
              <p style={{ marginTop: "10px", fontSize: "13px", color: "var(--text-secondary)" }}>
                By clicking the button below, you confirm that you meet the eligibility criteria to donate blood and will coordinate with the hospital.
              </p>

              <div style={{ marginTop: "24px" }}>
                {responseStatus ? (
                  <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--border)", textAlign: "center", background: "#fcfcfc" }}>
                    <div className="badge badge-success" style={{ padding: "6px 12px", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", display: "inline-block" }}>
                      {responseStatus}
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px" }}>
                      You have responded to this request. We will contact you shortly.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "100%", padding: "14px" }}
                    onClick={handleDonate}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "I Can Donate →"}
                  </button>
                )}
              </div>

              {message.text && (
                <div className={`auth-error ${message.type === "success" ? "badge-success" : ""}`} style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", border: "1px solid var(--border)", background: message.type === "success" ? "#eaf8f2" : "#fff3f5", marginTop: "16px" }}>
                  {message.text}
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="mobile-nav-bar">
        <Link to="/dashboard" className="mobile-nav-item">
          <span>⌂</span>
          Dashboard
        </Link>
        <Link to="/requirements" className="mobile-nav-item active">
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

export default RequirementDetail;
