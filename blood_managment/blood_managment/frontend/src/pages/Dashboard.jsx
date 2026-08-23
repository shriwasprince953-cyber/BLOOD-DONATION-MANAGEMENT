import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import api from "../api/axios";

function Icon({ children }) {
  return <span className="dashboard-icon">{children}</span>;
}

function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Prince");
  const [userInitial, setUserInitial] = useState("S");
  const [requirements, setRequirements] = useState([
    {
      id: "1",
      bloodGroup: "O-",
      title: "Urgent blood requirement",
      hospital: "City Care Hospital",
      location: "Nagpur, Maharashtra",
      units: 3,
      urgency: "URGENT",
      posted: "18 minutes ago",
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
    },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const user = session.user;
          const fullName = user.user_metadata?.full_name || localStorage.getItem("temp_fullName") || "Prince";
          setUserName(fullName);
          const initial = fullName.charAt(0).toUpperCase();
          setUserInitial(initial);
        }

        // Try to fetch real matching requirements for donor
        try {
          const res = await api.get("/donors/me/requirements");
          if (res.data && res.data.length > 0) {
            setRequirements(res.data.map(item => ({
              id: item.id,
              bloodGroup: item.blood_group,
              title: `Blood Requirement for ${item.patient_name}`,
              hospital: item.hospital_name,
              location: item.location,
              units: item.units_required,
              urgency: item.urgency_level,
              posted: "Just now",
            })));
          }
        } catch (apiErr) {
          console.warn("Backend API matching requirements call failed, using mock list:", apiErr);
          const localReqs = JSON.parse(localStorage.getItem("temp_requirements") || "[]");
          if (localReqs.length > 0) {
            setRequirements(localReqs.map(req => ({
              id: req.id,
              bloodGroup: req.bloodGroup || req.blood_group,
              title: req.title || `Blood Requirement for ${req.patientName || 'Unknown'}`,
              hospital: req.hospital || req.hospital_name,
              location: req.location,
              units: req.units || req.units_required,
              urgency: req.urgency || req.urgency_level,
              posted: req.posted || "Just now",
              distance: req.distance || "Nearby",
            })));
          }
        }
      } catch (err) {
        console.error("Session error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, []);

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
            <span>Donor Network</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-label">MENU</span>

          <Link to="/dashboard" className="nav-item active">
            <Icon>⌂</Icon>
            Dashboard
          </Link>

          <Link to="/requirements" className="nav-item">
            <Icon>♥</Icon>
            Blood Requests
          </Link>

          <Link to="/profile" className="nav-item">
            <Icon>◉</Icon>
            My Profile
          </Link>

          <span className="nav-label nav-label-space">ACCOUNT</span>

          <button type="button" className="nav-item nav-button" onClick={() => navigate("/profile")}>
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

      {/* Main */}
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
          {/* Welcome */}
          <section className="welcome-section">
            <div>

              <h1>
                Welcome back, <span>{userName}.</span>
              </h1>

              <p>
                Your next donation could be someone's
                second chance at life.
              </p>
            </div>

            <div className="blood-orb">
              <div className="orb-inner">
                <span>🩸</span>
              </div>
            </div>
          </section>

          {/* Stats */}
          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon red">
                🩸
              </div>

              <div>
                <span>Total Donations</span>
                <strong>0</strong>
              </div>

              <small>Keep making a difference</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">
                ✓
              </div>

              <div>
                <span>Lives Impacted</span>
                <strong>0</strong>
              </div>

              <small>Every donation matters</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">
                ♡
              </div>

              <div>
                <span>Available Requests</span>
                <strong>{requirements.length}</strong>
              </div>

              <small>People need your help</small>
            </div>
          </section>

          {/* Main grid */}
          <section className="dashboard-grid">
            <div className="requests-section">
              <div className="section-heading">
                <div>
                  <span className="section-eyebrow">
                    NEEDS YOUR ATTENTION
                  </span>

                  <h2>Nearby blood requests</h2>
                </div>

                <Link to="/requirements" className="view-all">
                  View all →
                </Link>
              </div>

              {loading ? (
                <div style={{ display: "grid", placeItems: "center", padding: "40px" }}>
                  <div className="spinner" style={{ borderTopColor: "var(--primary)" }}></div>
                </div>
              ) : (
                requirements.map((req) => (
                  <article key={req.id} className={`request-card ${req.urgency === "URGENT" || req.urgency === "HIGH" ? "urgent" : ""}`}>
                    <div className="request-top">
                      <div className="blood-group">
                        <span>{req.bloodGroup}</span>
                      </div>

                      <div className="request-title">
                        <div>
                          <h3>{req.title}</h3>
                          <span>Posted {req.posted}</span>
                        </div>

                        <span className={req.urgency === "URGENT" || req.urgency === "HIGH" ? "urgency-badge" : "normal-badge"}>
                          {req.urgency}
                        </span>
                      </div>
                    </div>

                    <div className="request-details">
                      <div>
                        <span>🏥</span>
                        <div>
                          <small>Hospital</small>
                          <strong>{req.hospital}</strong>
                        </div>
                      </div>

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
                          <small>Required</small>
                          <strong>{req.units} units</strong>
                        </div>
                      </div>
                    </div>

                    <div className="request-action">
                      <span>Your blood group matches this request.</span>

                      <button type="button" className="donate-button" onClick={() => navigate(`/requirements/${req.id}`)}>
                        I Can Donate →
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            {/* Profile Progress Card */}
            <aside className="profile-progress-card">
              <div className="profile-card-header">
                <div>
                  <span className="section-eyebrow">
                    YOUR PROFILE
                  </span>

                  <h2>Almost there</h2>
                </div>

                <div className="progress-circle">
                  <span>72%</span>
                </div>
              </div>

              <p>
                Complete your donor profile so we can
                connect you with the right requests.
              </p>

              <div className="progress-track">
                <div className="progress-value" />
              </div>

              <div className="profile-checks">
                <div className="completed">
                  <span>✓</span>
                  Basic information
                </div>

                <div className="completed">
                  <span>✓</span>
                  Contact details
                </div>

                <div>
                  <span>○</span>
                  Blood information
                </div>

                <div>
                  <span>○</span>
                  Location
                </div>
              </div>

              <Link to="/profile" className="complete-profile">
                Complete profile →
              </Link>
            </aside>
          </section>
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="mobile-nav-bar">
        <Link to="/dashboard" className="mobile-nav-item active">
          <span>⌂</span>
          Dashboard
        </Link>
        <Link to="/requirements" className="mobile-nav-item">
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

export default Dashboard;