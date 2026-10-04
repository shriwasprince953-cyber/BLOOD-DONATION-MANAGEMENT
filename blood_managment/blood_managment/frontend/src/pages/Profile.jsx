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
    bloodGroup: "",
    city: "",
    isAvailable: true,
    lastDonationDate: "",
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [userInitial, setUserInitial] = useState("U");

  const [hasDonor, setHasDonor] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [role, setRole] = useState(null);
  const [registerDonor, setRegisterDonor] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setFetching(true);
      setLoadFailed(false);
      try {
        const { data } = await api.get("/auth/me");
        if (!active) return;
        setProfile({ fullName: data.full_name, email: data.email, phoneNumber: data.phone_number || "" });
        setUserInitial(data.full_name.charAt(0).toUpperCase());
        setHasDonor(Boolean(data.donor));
        setRole(data.role);
        setRegisterDonor(Boolean(data.donor));
        if (data.donor) setDonor({
          bloodGroup: data.donor.blood_group, city: data.donor.city || "",
          isAvailable: data.donor.is_available, lastDonationDate: data.donor.last_donation_date || "",
        });
      } catch (error) {
        if (active) {
          setLoadFailed(true);
          setMessage({ type: "error", text: error.message });
        }
      } finally {
        if (active) setFetching(false);
      }
    }
    void loadData();
    return () => { active = false; };
  }, [attempt]);

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

    try {
      const { data } = await api.put("/auth/me", {
        full_name: profile.fullName.trim(), phone_number: profile.phoneNumber.trim() || null,
        donor: registerDonor ? {
          blood_group: donor.bloodGroup, is_available: donor.isAvailable,
          city: donor.city.trim() || null, last_donation_date: donor.lastDonationDate || null,
        } : null,
      });
      setProfile({ fullName: data.full_name, email: data.email, phoneNumber: data.phone_number || "" });
      setHasDonor(Boolean(data.donor));
      setRegisterDonor(Boolean(data.donor));
      if (data.donor) setDonor({ bloodGroup: data.donor.blood_group, city: data.donor.city || "",
        isAvailable: data.donor.is_available, lastDonationDate: data.donor.last_donation_date || "" });
      setUserInitial(data.full_name.charAt(0).toUpperCase());
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error) {
      setMessage({ type: "error", text: `Could not confirm the save. ${error.message}` });
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

          <Link to={role === "ADMIN" ? "/admin" : "/dashboard"} className="nav-item">
            <Icon>⌂</Icon>
            Dashboard
          </Link>

          <Link to={role === "ADMIN" ? "/admin/donor-view" : "/requirements"} className="nav-item">
            <Icon>♥</Icon>
            Blood Requests
          </Link>

          <Link to="/profile" className="nav-item active">
            <Icon>◉</Icon>
            My Profile
          </Link>

          <span className="nav-label nav-label-space">ACCOUNT</span>

          <button type="button" className="nav-item nav-button" onClick={() => document.getElementById("fullName")?.focus()}>
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
                <span>{role === "ADMIN" ? "Administrator" : hasDonor ? "Donor" : "Registered user"}</span>
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
          ) : loadFailed ? (
            <div role="alert" className="auth-error"><p>{message.text}</p>
              <button type="button" className="btn btn-secondary" onClick={() => setAttempt(n => n + 1)}>Retry profile</button></div>
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
                      minLength={2}
                      maxLength={255}
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
                      maxLength={20}
                      value={profile.phoneNumber}
                      onChange={handleProfileChange}
                    />
                  </div>

                  {!hasDonor && <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                    <p>Your account is registered. Donor registration is optional; save your blood group to appear in matches.</p>
                    <label><input type="checkbox" checked={registerDonor} onChange={event => setRegisterDonor(event.target.checked)} /> Register as a blood donor</label>
                  </div>}
                  {registerDonor && <>
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
                      disabled={hasDonor}
                      required
                      onChange={handleDonorChange}
                    >
                      <option value="" disabled>Select your blood group</option>
                      {bloodGroups.map((group) => (
                        <option key={group} value={group}>
                          {group}
                        </option>
                      ))}
                    </select>
                  </div>

                  {hasDonor && <p>Blood group is locked after registration. Contact an administrator for corrections.</p>}
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
                      maxLength={100}
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
                  </>}
                </div>

                {/* Availability Status */}
                {registerDonor &&
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
                </div>}

                {message.text && (
                  <div className={`auth-error ${message.type === "success" ? "badge-success" : ""}`} style={{ color: message.type === "success" ? "var(--success)" : "var(--danger)", border: "1px solid var(--border)", background: message.type === "success" ? "#eaf8f2" : "#fff3f5" }}>
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || loadFailed}
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
        <Link to={role === "ADMIN" ? "/admin" : "/dashboard"} className="mobile-nav-item">
          <span>⌂</span>
          Dashboard
        </Link>
        <Link to={role === "ADMIN" ? "/admin/donor-view" : "/requirements"} className="mobile-nav-item">
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
