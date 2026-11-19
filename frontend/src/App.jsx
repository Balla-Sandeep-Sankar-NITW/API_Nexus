import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import AppShell from "./components/AppShell";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import SharedProject from "./pages/SharedProject";
import Dashboard from "./pages/Dashboard";
import LoadingRow from "./components/ui/LoadingRow";
import { PageSkeleton } from "./components/ui/Skeleton";
import TopProgress from "./components/TopProgress";
import AuthCallback from "./pages/AuthCallback";

// Heavier or rarely-first pages load on demand, which keeps the first screen fast.
const ProjectGraph = lazy(() => import("./pages/ProjectGraph"));
const Legal = {
  Terms: lazy(() => import("./pages/Legal").then((m) => ({ default: m.Terms }))),
  Privacy: lazy(() => import("./pages/Legal").then((m) => ({ default: m.Privacy }))),
  AcceptableUse: lazy(() => import("./pages/Legal").then((m) => ({ default: m.AcceptableUse }))),
  Cookies: lazy(() => import("./pages/Legal").then((m) => ({ default: m.Cookies }))),
};
const Info = {
  About: lazy(() => import("./pages/Info").then((m) => ({ default: m.About }))),
  Help: lazy(() => import("./pages/Info").then((m) => ({ default: m.Help }))),
  NotFound: lazy(() => import("./pages/Info").then((m) => ({ default: m.NotFound }))),
};

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <LoadingRow />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <Login />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthed>
            <Register />
          </RedirectIfAuthed>
        }
      />
      {/* Reachable signed in or out: these are the targets of emailed links. */}
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Public read-only view of a project the leader chose to share. */}
      <Route path="/shared/:token" element={<SharedProject />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      {/* Public information pages: reachable signed in or out. */}
      <Route path="/terms" element={<Legal.Terms />} />
      <Route path="/privacy" element={<Legal.Privacy />} />
      <Route path="/acceptable-use" element={<Legal.AcceptableUse />} />
      <Route path="/cookies" element={<Legal.Cookies />} />
      <Route path="/about" element={<Info.About />} />
      <Route path="/help" element={<Info.Help />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="projects/:projectId" element={<ProjectGraph />} />
      </Route>
      <Route path="*" element={<Info.NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <TopProgress />
        <Suspense fallback={<PageSkeleton />}>
          <AppRoutes />
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  );
}
