import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Requirements = lazy(() => import("./pages/Requirements"));
const Profile = lazy(() => import("./pages/Profile"));
const RequirementDetail = lazy(() => import("./pages/RequirementDetail"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDonorView = lazy(() => import("./pages/AdminDonorView"));
const PasswordRecovery = lazy(() => import("./pages/PasswordRecovery"));
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="auth-page" role="status">Loading...</div>}>
        <Routes>
          <Route
            path="/"
            element={<Navigate to="/login" replace />}
          />

          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<PasswordRecovery />} />
          <Route path="/reset-password" element={<PasswordRecovery reset />} />

          <Route
            path="/register"
            element={<Register />}
          />

          <Route
            path="/dashboard"
            element={<ProtectedRoute requiredRole="DONOR"><Dashboard /></ProtectedRoute>}
          />

          <Route
            path="/requirements"
            element={<ProtectedRoute requiredRole="DONOR"><Requirements /></ProtectedRoute>}
          />

          <Route
            path="/requirements/:id"
            element={<ProtectedRoute requiredRole="DONOR"><RequirementDetail /></ProtectedRoute>}
          />

          <Route
            path="/profile"
            element={<ProtectedRoute><Profile /></ProtectedRoute>}
          />

          <Route
            path="/admin/login"
            element={<AdminLogin />}
          />

          <Route
            path="/admin"
            element={<ProtectedRoute requiredRole="ADMIN"><AdminDashboard /></ProtectedRoute>}
          />

          <Route
            path="/admin/donor-view"
            element={<ProtectedRoute requiredRole="ADMIN"><AdminDonorView /></ProtectedRoute>}
          />

          <Route
            path="*"
            element={<Navigate to="/login" replace />}
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
