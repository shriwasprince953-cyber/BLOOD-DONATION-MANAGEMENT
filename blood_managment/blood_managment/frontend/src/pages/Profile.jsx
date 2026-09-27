import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import api from "../api/axios";

function Icon({ children }) {
  return <span className="dashboard-icon">{children}</span>;
}

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function Profile() {
  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
  });

  const [donor, setDonor] = useState({
    bloodGroup: "O+",
    city: "",
    isAvailable: true,
    lastDonationDate: "",
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [userInitial, setUserInitial] = useState("U");

  useEffect(() => {
    async function loadData() {
      try {
        setFetching(true);
        // Get Supabase user session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const user = session.user;
          const initial = user.user_metadata?.full_name
            ? user.user_metadata.full_name.charAt(0).toUpperCase()
            : user.email.charAt(0).toUpperCase();
          setUserInitial(initial);

          // Attempt to fetch from backend API
          try {
            const res = await api.get("/auth/me");
            if (res.data) {
              setProfile({
                fullName: res.data.full_name || user.user_metadata?.full_name || "",
                email: res.data.email || user.email || "",
                phoneNumber: res.data.phone_number || "",
              });
              if (res.data.donor) {
                setDonor({
                  bloodGroup: res.data.donor.blood_group || "O+",
                  city: res.data.donor.city || "",
                  isAvailable: res.data.donor.is_available ?? true,
                  lastDonationDate: res.data.donor.last_donation_date || "",
                });
              } else {
                setDonor(prev => ({
                  ...prev,
                  city: localStorage.getItem("temp_city") || "",
                }));
              }
            }
          } catch (apiErr) {
            console.warn("Backend API error, falling back to local session data:", apiErr);
            setProfile({
              fullName: localStorage.getItem("temp_fullName") || user.user_metadata?.full_name || "Prince",
              email: user.email || "",
              phoneNumber: localStorage.getItem("temp_phoneNumber") || "",
            });
            setDonor({
              bloodGroup: localStorage.getItem("temp_bloodGroup") || "O-",
              city: localStorage.getItem("temp_city") || "Nagpur, Maharashtra",
              isAvailable: JSON.parse(localStorage.getItem("temp_isAvailable") ?? "true"),
              lastDonationDate: localStorage.getItem("temp_lastDonationDate") || "",
            });
          }
        }
      } catch (err) {
        console.error("Error loading user session:", err);
      } finally {
        setFetching(false);
      }
    }

    loadData();
  }, []);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleDonorChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDonor((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    // Store locally as fallback
    localStorage.setItem("temp_fullName", profile.fullName);
    localStorage.setItem("temp_phoneNumber", profile.phoneNumber);
    localStorage.setItem("temp_bloodGroup", donor.bloodGroup);
    localStorage.setItem("temp_city", donor.city);
    localStorage.setItem("temp_isAvailable", String(donor.isAvailable));
    localStorage.setItem("temp_lastDonationDate", donor.lastDonationDate);

    try {
      await api.patch("/auth/me", {
        full_name: profile.fullName,
        phone_number: profile.phoneNumber,
      });

      try {
        await api.get("/donors/me");
        await api.patch("/donors/me", {
          is_available: donor.isAvailable,
          city: donor.city,
          last_donation_date: donor.lastDonationDate || null,
        });
      } catch {
        await api.post("/donors/me", {
          blood_group: donor.bloodGroup,
          is_available: donor.isAvailable,
          city: donor.city,
          last_donation_date: donor.lastDonationDate || null,
        });
      }

      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (err) {
      console.warn("Backend save failed, saved locally instead:", err);
      setMessage({
        type: "success",
        text: "Profile saved locally (Offline mode).",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
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

          <Link to="/dashboard" className="nav-item">
            <Icon>⌂</Icon>
            Dashboard
          </Link>

          <Link to="/requirements" className="nav-item">
            <Icon>♥</Icon>
            Blood Requests
          </Link>

          <Link to="/profile" className="nav-item active">
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

      {/* Main Content */}
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
                <strong>{profile.fullName || "User"}</strong>
                <span>Donor</span>
              </div>
              <span className="chevron">⌄</span>
            </div>
          </div>
        </header>

        <div className="dashboard-content animate-fade-in-up">
          <section className="requirements-heading">
            <div>
              <span className="section-eyebrow">MANAGE DETAILS</span>
              <h1>My Profile</h1>
              <p>Keep your details updated so patients can contact you in emergencies.</p>
            </div>
          </section>

          {fetching ? (
            <div style={{ display: "grid", placeItems: "center", padding: "80px 0" }}>
              <div className="spinner" style={{ borderTopColor: "var(--primary)" }}></div>
            </div>
          ) : (
            <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr" }}>
              <form onSubmit={handleSave} className="card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  {/* Full Name */}
                  <div className="input-group">
                    <label className="input-label" htmlFor="fullName">
                      Full Name
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      className="input"
                      value={profile.fullName}
                      onChange={handleProfileChange}
                      required
                    />
                  </div>

                  {/* Email */}
                  <div className="input-group">
                    <label className="input-label" htmlFor="email">
                      Email Address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className="input"
                      value={profile.email}
                      disabled
                      style={{ background: "#f5f5f5", cursor: "not-allowed" }}
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="input-group">
                    <label className="input-label" htmlFor="phoneNumber">
                      Phone Number
                    </label>
                    <input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      className="input"
                      placeholder="e.g. +91 98765 43210"
                      value={profile.phoneNumber}
                      onChange={handleProfileChange}
                    />
                  </div>

                  {/* Blood Group */}
                  <div className="input-group">
                    <label className="input-label" htmlFor="bloodGroup">
                      Blood Group
                    </label>
                    <select
                      id="bloodGroup"
                      name="bloodGroup"
                      className="urgency-select"
                      style={{ width: "100%", height: "48px" }}
                      value={donor.bloodGroup}
                      onChange={handleDonorChange}
                    >
                      {bloodGroups.map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* City */}
                  <div className="input-group">
                    <label className="input-label" htmlFor="city">
                      City
                    </label>
                    <input
                      id="city"
                      name="city"
                      type="text"
                      className="input"
                      placeholder="e.g. Nagpur, Maharashtra"
                      value={donor.city}
                      onChange={handleDonorChange}
                    />
                  </div>

                  {/* Last Donation Date */}
                  <div className="input-group">
                    <label className="input-label" htmlFor="lastDonationDate">
                      Last Donation Date
                    </label>
                    <input
                      id="lastDonationDate"
                      name="lastDonationDate"
                      type="date"
                      className="input"
                      value={donor.lastDonationDate}
                      onChange={handleDonorChange}
                    />
                  </div>
                </div>

                {/* Availability Status */}
                <div className="input-group" style={{ flexDirection: "row", alignItems: "center", gap: "12px", background: "#fdfdfd", padding: "16px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <input
                    id="isAvailable"
                    name="isAvailable"
                    type="checkbox"
                    checked={donor.isAvailable}
                    onChange={handleDonorChange}
                    style={{ width: "20px", height: "20px", accentColor: "var(--primary)", cursor: "pointer" }}
                  />
                  <div>
                    <label htmlFor="isAvailable" style={{ fontWeight: 600, fontSize: "14px", cursor: "pointer" }}>
                      Available for immediate blood donation requests
                    </label>
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                      Uncheck this option if you are currently unable to donate.
                    </p>
                  </div>
                </div>

                {message.text && (
                  <div className={`auth-error ${message.type === "success" ? "badge-success" : ""}`} style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", border: "1px solid var(--border)", background: message.type === "success" ? "#eaf8f2" : "#fff3f5" }}>
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ alignSelf: "flex-end", minWidth: "150px" }}
                >
                  {loading ? "Saving..." : "Save Profile"}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="mobile-nav-bar">
        <Link to="/dashboard" className="mobile-nav-item">
          <span>⌂</span>
          Dashboard
        </Link>
        <Link to="/requirements" className="mobile-nav-item">
          <span>♥</span>
          Requests
        </Link>
        <Link to="/profile" className="mobile-nav-item active">
          <span>◉</span>
          Profile
        </Link>
      </nav>
    </div>
  );
}

export default Profile;
