import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthed, checkDailyExpiry, getRole, getHomeRoute, getAuth } from "../utils/auth";
import { pagesFor } from "../utils/rolePages";

export default function ProtectedRoute() {
  const { pathname } = useLocation();
  if (checkDailyExpiry()) return <Navigate to="/login" replace />;
  if (!isAuthed()) return <Navigate to="/login" replace />;
  // GEM has paused the gym's account: only the screen that says so opens
  if (getAuth()?.user?.gymLocked && pathname !== '/account-paused') return <Navigate to="/account-paused" replace />;
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
