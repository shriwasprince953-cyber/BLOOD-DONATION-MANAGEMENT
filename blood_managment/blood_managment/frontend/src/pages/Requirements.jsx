import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import useRequests from "../hooks/useRequests";
import RequestState from "../components/RequestState";
import Pagination from "../components/Pagination";



function Requirements() {
  const navigate = useNavigate();
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [selectedUrgency, setSelectedUrgency] = useState("All");
  const [offset, setOffset] = useState(0);
  const { profile, requirements, loading, error: loadError, total, retry } = useRequests({
    preview: false, group: selectedGroup, urgency: selectedUrgency, offset,
  });
  const userName = profile?.full_name || "User";
  const userInitial = userName.charAt(0).toUpperCase();
  const needsProfile = !loading && !loadError && !profile?.donor;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const filteredRequirements = requirements;

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
            <span className="dashboard-icon">⌂</span>
            Dashboard
          </Link>

          <Link
            to="/requirements"
            className="nav-item active"
          >
            <span className="dashboard-icon">♥</span>
            Blood Requests
          </Link>

          <Link to="/profile" className="nav-item">
            <span className="dashboard-icon">◉</span>
            My Profile
          </Link>

          <span className="nav-label nav-label-space">
            ACCOUNT
          </span>

          <button type="button" className="nav-item nav-button" onClick={() => navigate("/profile")}>
            <span className="dashboard-icon">⚙</span>
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
        <header className="dashboard-topbar">
          <span className="mobile-brand">
            🩸 RaktSetu
          </span>

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

          {/* Page heading */}
          <section className="requirements-heading">
            <div>
              <span className="section-eyebrow">
                MAKE A DIFFERENCE
              </span>

              <h1>Blood requests</h1>

              <p>
                Active requests for your exact blood group across all cities. No distance filter is applied.
              </p>
            </div>

            <div className="request-count">
              <strong>{total ?? "—"}</strong>
              <span>active requests</span>
            </div>
          </section>

          {/* Filters */}
          <section className="filters-card">
            <div className="filter-title">
              <span>FILTER BY</span>
            </div>

            <div className="filter-group">
              <label>Blood group</label>

              <div className="filter-pills">
                {["All", ...(profile?.donor ? [profile.donor.blood_group] : [])].map((group) => (
                  <button
                    key={group}
                    className={`filter-pill ${selectedGroup === group
                        ? "selected"
                        : ""
                      }`}
                    onClick={() => { setSelectedGroup(group); setOffset(0); }}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group urgency-filter">
              <label>Urgency</label>

              <select
                value={selectedUrgency}
                onChange={event => { setSelectedUrgency(event.target.value); setOffset(0); }}
                className="urgency-select"
              >
                <option value="All">All urgency levels</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </section>

          {/* Results */}
          <section className="requirements-list">
            <div className="results-heading">
              <h2>Available requests</h2>

              <span>
                {total ?? "—"} results
              </span>
            </div>

            {loading ? (
              <div style={{ display: "grid", placeItems: "center", padding: "80px 0" }}>
                <div className="spinner" style={{ borderTopColor: "var(--primary)" }}></div>
              </div>
            ) : loadError ? <RequestState error={loadError} retry={retry} /> : needsProfile ? <RequestState needsProfile /> : filteredRequirements.length > 0 ? (
              filteredRequirements.map((requirement) => (
                <article
                  className="requirement-large-card"
                  key={requirement.id}
                >
                  <div className="large-blood-group">
                    {requirement.bloodGroup}
                  </div>

                  <div className="requirement-main">
                    <div className="requirement-header">
                      <div>
                        <div className="requirement-title-row">
                          <h3>{requirement.title}</h3>

                          <span
                            className={`urgency-label ${requirement.urgency.toLowerCase()}`}
                          >
                            {requirement.urgency}
                          </span>
                        </div>

                        <span className="posted-time">
                          Posted {requirement.posted}
                        </span>
                      </div>

                      <div className="distance">
                        📍 {requirement.distance}
                      </div>
                    </div>

                    <div className="large-details">
                      <div>
                        <span>🏥</span>

                        <div>
                          <small>Hospital</small>
                          <strong>
                            {requirement.hospital}
                          </strong>
                        </div>
                      </div>

                      <div>
                        <span>📍</span>

                        <div>
                          <small>Location</small>
                          <strong>
                            {requirement.location}
                          </strong>
                        </div>
                      </div>

                      <div>
                        <span>◉</span>

                        <div>
                          <small>Blood required</small>
                          <strong>
                            {requirement.units} units
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="requirement-footer">
                      <span>
                        Every donation makes a difference.
                      </span>

                      <Link
                        to={`/requirements/${requirement.id}`}
                        className="donate-button"
                      >
                        View request →
                      </Link>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-requirements">
                <div>🩸</div>

                <h3>No matching requests</h3>

                <p>
                  Try changing your blood group or urgency
                  filters.
                </p>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedGroup("All");
                    setOffset(0);
                    setSelectedUrgency("All");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            {!loading && !loadError && total != null && <Pagination offset={offset} limit={20} total={total} onChange={setOffset} />}
          </section>
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

export default Requirements;
