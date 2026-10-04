import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import useRequests from "../hooks/useRequests";
import RequestState from "../components/RequestState";

function Icon({ children }) {
  return <span className="dashboard-icon">{children}</span>;
}

function Dashboard() {
  const navigate = useNavigate();
  const { profile, requirements, loading, error: loadError, total, retry } = useRequests({ limit: 6 });
  const userName = profile?.full_name || "User";
  const userInitial = userName.charAt(0).toUpperCase();
  const needsProfile = !loading && !loadError && !profile?.donor;

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
                <span>{profile?.donor ? "Donor" : "Registered user"}</span>
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
                <span>Blood Group</span>
                <strong>{loading || loadError ? "—" : profile?.donor?.blood_group || "Not registered"}</strong>
              </div>

              <small>Saved donor profile</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">
                ✓
              </div>

              <div>
                <span>Donation Availability</span>
                <strong>{loading || loadError ? "—" : !profile?.donor ? "Not registered" : profile.donor.is_available ? "Available" : "Unavailable"}</strong>
              </div>

              <small>Update in My Profile</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">
                ♡
              </div>

              <div>
                <span>Available Requests</span>
                <strong>{total ?? "—"}</strong>
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

                  <h2>Matching blood requests</h2>
                </div>

                <Link to="/requirements" className="view-all">
                  View all →
                </Link>
              </div>

              {loading ? (
                <div style={{ display: "grid", placeItems: "center", padding: "40px" }}>
                  <div className="spinner" style={{ borderTopColor: "var(--primary)" }}></div>
                </div>
              ) : loadError || needsProfile ? (
                <RequestState error={loadError} retry={retry} needsProfile={needsProfile} />
              ) : (
                requirements.length === 0 ? <p>No active requests match your blood group right now.</p> : requirements.map((req) => (
                  <article key={req.id} className={`request-card ${req.urgency === "CRITICAL" || req.urgency === "HIGH" ? "urgent" : ""}`}>
                    <div className="request-top">
                      <div className="blood-group">
                        <span>{req.bloodGroup}</span>
                      </div>

                      <div className="request-title">
                        <div>
                          <h3>{req.title}</h3>
                          <span>Posted {req.posted}</span>
                        </div>

                        <span className={req.urgency === "CRITICAL" || req.urgency === "HIGH" ? "urgency-badge" : "normal-badge"}>
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
                      <span>{profile?.donor?.is_available ? "Your blood group matches this request." : "Availability is off. Enable it in My Profile before responding."}</span>

                      <button type="button" className="donate-button" onClick={() => navigate(`/requirements/${req.id}`)}>
                        View Request →
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            <aside className="profile-progress-card">
              <h2>Your donor profile</h2>
              <p>Keep your contact details, blood group and availability up to date.</p>
              <Link to="/profile" className="complete-profile">Review profile</Link>
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
