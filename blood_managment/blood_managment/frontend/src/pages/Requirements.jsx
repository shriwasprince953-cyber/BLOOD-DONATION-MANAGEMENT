import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import api from "../api/axios";
import { mapRequirement } from "../lib/requirements";

const bloodGroups = [
  "All",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

function Requirements() {
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [selectedUrgency, setSelectedUrgency] = useState("All");
  const [userName, setUserName] = useState("Donor");
  const [userInitial, setUserInitial] = useState("D");
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const { data: profile } = await api.get("/auth/me");
        if (!active) return;
        setUserName(profile.full_name);
        setUserInitial(profile.full_name.charAt(0).toUpperCase());
        const result = await api.get("/donors/me/requirements?limit=100");
        if (active) setRequirements(result.data.map(mapRequirement));
      } catch (error) {
        if (active) setLoadError(error.status === 403
          ? "Complete your donor profile to see matching requests."
          : error.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadData();
    return () => { active = false; };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const filteredRequirements = requirements.filter((requirement) => {
    const groupMatches =
      selectedGroup === "All" ||
      requirement.bloodGroup === selectedGroup;

    const urgencyMatches =
      selectedUrgency === "All" ||
      requirement.urgency === selectedUrgency;

    return groupMatches && urgencyMatches;
  });

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
                <span>Donor</span>
              </div>

              <span className="chevron">⌄</span>
            </div>
          </div>
        </header>

        <div className="dashboard-content animate-fade-in-up">
          {loadError && <p className="auth-error" role="alert">{loadError}</p>}
          {/* Page heading */}
          <section className="requirements-heading">
            <div>
              <span className="section-eyebrow">
                MAKE A DIFFERENCE
              </span>

              <h1>Blood requests</h1>

              <p>
                Find people nearby who need your blood group.
                One donation can save lives.
              </p>
            </div>

            <div className="request-count">
              <strong>{filteredRequirements.length}</strong>
              <span>open requests</span>
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
                {bloodGroups.map((group) => (
                  <button
                    key={group}
                    className={`filter-pill ${selectedGroup === group
                        ? "selected"
                        : ""
                      }`}
                    onClick={() => setSelectedGroup(group)}
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
                onChange={(event) =>
                  setSelectedUrgency(event.target.value)
                }
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
                {filteredRequirements.length} results
              </span>
            </div>

            {loading ? (
              <div style={{ display: "grid", placeItems: "center", padding: "80px 0" }}>
                <div className="spinner" style={{ borderTopColor: "var(--primary)" }}></div>
              </div>
            ) : filteredRequirements.length > 0 ? (
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
                    setSelectedUrgency("All");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
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