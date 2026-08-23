import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import api from "../api/axios";

const initialRequirements = [
  {
    id: 1,
    bloodGroup: "O-",
    title: "Urgent blood requirement",
    hospital: "City Care Hospital",
    location: "Nagpur, Maharashtra",
    units: 3,
    urgency: "URGENT",
    posted: "18 minutes ago",
    distance: "3.2 km",
  },
  {
    id: 2,
    bloodGroup: "A+",
    title: "Blood donation needed",
    hospital: "Orange City Hospital",
    location: "Nagpur, Maharashtra",
    units: 2,
    urgency: "NORMAL",
    posted: "1 hour ago",
    distance: "5.8 km",
  },
  {
    id: 3,
    bloodGroup: "B+",
    title: "Immediate blood requirement",
    hospital: "Wockhardt Hospital",
    location: "Nagpur, Maharashtra",
    units: 4,
    urgency: "HIGH",
    posted: "2 hours ago",
    distance: "7.1 km",
  },
  {
    id: 4,
    bloodGroup: "AB+",
    title: "Blood required for surgery",
    hospital: "Alexis Hospital",
    location: "Nagpur, Maharashtra",
    units: 2,
    urgency: "HIGH",
    posted: "3 hours ago",
    distance: "8.4 km",
  },
  {
    id: 5,
    bloodGroup: "O+",
    title: "Blood donation request",
    hospital: "SevenStar Hospital",
    location: "Nagpur, Maharashtra",
    units: 1,
    urgency: "NORMAL",
    posted: "5 hours ago",
    distance: "10.2 km",
  },
];

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

function Icon({ children }) {
  return <span className="dashboard-icon">{children}</span>;
}

function AdminDonorView() {
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState(initialRequirements);
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [selectedUrgency, setSelectedUrgency] = useState("All");
  const [userName, setUserName] = useState("Admin User");
  const [userInitial, setUserInitial] = useState("A");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const user = session.user;
          const fullName = user.user_metadata?.full_name || localStorage.getItem("temp_fullName") || "Admin User";
          setUserName(fullName);
          setUserInitial(fullName.charAt(0).toUpperCase());
        }

        try {
          const res = await api.get("/requirements?limit=100");
          if (res.data && res.data.items) {
            setRequirements(res.data.items.map(item => ({
              id: item.id,
              bloodGroup: item.blood_group,
              title: `Blood Requirement for ${item.patient_name}`,
              hospital: item.hospital_name,
              location: item.location,
              units: item.units_required,
              urgency: item.urgency_level,
              posted: "Just now",
              distance: "Nearby",
            })));
          }
        } catch (apiErr) {
          console.warn("Backend API requirements call failed, using mock list:", apiErr);
          // Fallback to local storage if API fails
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
        console.error("Requirements load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
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
      {/* Admin Sidebar */}
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

          <Link to="/admin" className="nav-item">
            <Icon>⚙</Icon>
            Admin Dashboard
          </Link>

          <Link to="/admin/donor-view" className="nav-item active">
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

      {/* Main */}
      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <span className="mobile-brand">
            🩸 RaktSetu Admin
          </span>

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

        <div className="dashboard-content animate-fade-in-up">
          {/* Page heading */}
          <section className="requirements-heading">
            <div>
              <span className="section-eyebrow">
                DONOR PERSPECTIVE PREVIEW
              </span>

              <h1>Blood requests</h1>

              <p>
                Preview of what donors see when they browse the active requests in your area.
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
                    className={`filter-pill ${
                      selectedGroup === group
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
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="NORMAL">Normal</option>
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
        <Link to="/admin" className="mobile-nav-item">
          <span>⚙</span>
          Admin
        </Link>
        <Link to="/admin/donor-view" className="mobile-nav-item active">
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

export default AdminDonorView;
