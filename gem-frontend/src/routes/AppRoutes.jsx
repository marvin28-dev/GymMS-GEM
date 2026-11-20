import { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import ProtectedRoute, { RoleGuard } from "./ProtectedRoute";
import { appRoutes } from "./routeConfig";
import ScrollToTop from "../components/ScrollToTop";
import { isAuthed, checkDailyExpiry, getHomeRoute } from "../utils/auth";
import PageLoader from "../components/ui/PageLoader";

const LandingPage = lazy(() => import("../pages/LandingPage"));
const SignUpPage = lazy(() => import("../pages/SignUpPage"));
const GymCodePage = lazy(() => import("../pages/GymCodePage"));
const GymLoginPage = lazy(() => import("../pages/GymLoginPage"));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("../pages/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("../pages/VerifyEmailPage"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage"));
const FrontDeskPage = lazy(() => import("../pages/FrontDeskPage"));
const MemberProfilePage = lazy(() => import("../pages/MemberProfilePage"));
const StaffProfilePage = lazy(() => import("../pages/StaffProfilePage"));
const SupportPage = lazy(() => import("../pages/SupportPage"));
const AccountPausedPage = lazy(() => import("../pages/AccountPausedPage"));
// GEM's own admin dashboard: loaded only when opened, never by a gym
const AdminLoginPage = lazy(() => import("../pages/admin/AdminLoginPage"));
const AdminLayout = lazy(() => import("../pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("../pages/admin/AdminOverview"));
const AdminGyms = lazy(() => import("../pages/admin/AdminGyms"));
const AdminGymDetail = lazy(() => import("../pages/admin/AdminGymDetail"));
const AdminBilling = lazy(() => import("../pages/admin/AdminBilling"));
const AdminLeads = lazy(() => import("../pages/admin/AdminLeads"));
const AdminProblems = lazy(() => import("../pages/admin/AdminProblems"));
const AdminAnnouncements = lazy(() => import("../pages/admin/AdminAnnouncements"));
const AdminSettings = lazy(() => import("../pages/admin/AdminSettings"));

export default function AppRoutes() {
  // Clear expired auth before any route logic so isAuthed() reflects reality
  checkDailyExpiry();

  return (
    <>
    <ScrollToTop />
    {/* Pages arrive as they are first opened. A whole-screen page (the public
        pages, the front desk) shows the loader until its code has arrived;
        pages inside the app have their own, in AppLayout. */}
    <Suspense fallback={<PageLoader variant="screen" />}>
    <Routes>
      {/* Public marketing & auth */}
      <Route path="/" element={isAuthed() ? <Navigate to={getHomeRoute()} replace /> : <LandingPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route path="/login" element={<GymCodePage />} />
      <Route path="/:gymCode/login" element={<GymLoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* GEM's admin dashboard, apart from every gym (its own sign-in) */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="gyms" element={<AdminGyms />} />
        <Route path="gyms/:id" element={<AdminGymDetail />} />
        <Route path="billing" element={<AdminBilling />} />
        <Route path="leads" element={<AdminLeads />} />
        <Route path="problems" element={<AdminProblems />} />
        <Route path="announcements" element={<AdminAnnouncements />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* A gym GEM has paused: signed in, but only this screen opens */}
      <Route element={<ProtectedRoute />}>
        <Route path="/account-paused" element={<AccountPausedPage />} />
      </Route>

      {/* Fullscreen Front Desk (no app layout) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleGuard />}>
          <Route path="/front-desk" element={<FrontDeskPage />} />
          <Route path="/front-desk/member/:id" element={<MemberProfilePage />} />
          {/* Opening a colleague's profile from the desk keeps the desk: the
              person on it is mid-shift and should not land on the dashboard. */}
          <Route path="/front-desk/staff/:id" element={<StaffProfilePage />} />
          {/* Same for your own profile: "My Profile" from the desk header must
              not exit to the dashboard either. No :id means StaffProfilePage
              falls back to the signed-in user, i.e. your own record. */}
          <Route path="/front-desk/my-profile" element={<StaffProfilePage />} />
          {/* Help & support from the desk, without leaving it */}
          <Route path="/front-desk/support" element={<SupportPage />} />
        </Route>
      </Route>

      {/* Protected app (normal layout) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleGuard />}>
          <Route element={<AppLayout />}>
            {appRoutes.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
    </>
  );
}
