import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthed, checkDailyExpiry, getAuth, getRole, getHomeRoute } from "../utils/auth";
import { pagesFor } from "../utils/rolePages";

export default function ProtectedRoute() {
  if (checkDailyExpiry()) return <Navigate to="/login" replace />;
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Sits between ProtectedRoute and the page tree; redirects to the role's home
// when the user tries to reach a route outside their permitted pages.
export function RoleGuard() {
  const { pathname } = useLocation();
  const role = getRole();
  const roleProfile = pagesFor(role);
  const allowedPages = roleProfile?.pages; // null = general_manager (full access)

  if (!allowedPages) return <Outlet />;

  const segment = pathname.split('/').filter(Boolean)[0] || '';
  if (!allowedPages.includes(segment)) {
    const home = getHomeRoute();
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}
