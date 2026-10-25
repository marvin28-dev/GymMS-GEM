import { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import ProtectedRoute, { RoleGuard } from "./ProtectedRoute";
import { appRoutes } from "./routeConfig";
import ScrollToTop from "../components/ScrollToTop";
import { isAuthed, checkDailyExpiry, getHomeRoute } from "../utils/auth";

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

export default function AppRoutes() {
  // Clear expired auth before any route logic so isAuthed() reflects reality
  checkDailyExpiry();

  return (
    <>
    <ScrollToTop />
    {/* Pages arrive as they are first opened. Moving between pages keeps the
        current one on screen until the next has arrived (the router navigates
        in a transition), so only the very first page shows nothing meanwhile. */}
    <Suspense fallback={null}>
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
