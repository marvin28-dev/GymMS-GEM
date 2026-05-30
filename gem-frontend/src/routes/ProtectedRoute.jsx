import { Navigate, Outlet } from "react-router-dom";
import { isAuthed, checkDailyExpiry } from "../utils/auth";

export default function ProtectedRoute() {
  // Redirect to login if the stored loginDate is from a previous day
  if (checkDailyExpiry()) return <Navigate to="/login" replace />;
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return <Outlet />;
}
