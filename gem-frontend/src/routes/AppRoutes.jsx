import { Route, Routes, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import { appRoutes } from "./routeConfig";
import ScrollToTop from "../components/ScrollToTop";
import { isAuthed, checkDailyExpiry } from "../utils/auth";

import LandingPage from "../pages/LandingPage";
import SignUpPage from "../pages/SignUpPage";
import GymCodePage from "../pages/GymCodePage";
import GymLoginPage from "../pages/GymLoginPage";
import FrontDeskMode from "../pages/FrontDeskMode";
import FrontDeskPage from "../pages/FrontDeskPage";
import MemberProfilePage from "../pages/MemberProfilePage";

export default function AppRoutes() {
  // Clear expired auth before any route logic so isAuthed() reflects reality
  checkDailyExpiry();

  return (
    <>
    <ScrollToTop />
    <Routes>
      {/* Public marketing & auth */}
      <Route path="/" element={isAuthed() ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route path="/login" element={<GymCodePage />} />
      <Route path="/:gymCode/login" element={<GymLoginPage />} />

      {/* Fullscreen Front Desk (no app layout) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/front-desk/mode" element={<FrontDeskMode />} />
        <Route path="/front-desk" element={<FrontDeskPage />} />
        <Route path="/front-desk/member/:id" element={<MemberProfilePage />} />
      </Route>

      {/* Protected app (normal layout) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {appRoutes.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
