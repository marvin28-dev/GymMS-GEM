// src/routes/routeConfig.jsx
// Each page is its own file, fetched the first time it is opened (F-024): the
// whole app as one 2.6 MB script was slow to start on a phone.
import { lazy } from "react";
const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const MembersPage = lazy(() => import("../pages/MembersPage"));
const MemberProfilePage = lazy(() => import("../pages/MemberProfilePage"));
const AttendancePage = lazy(() => import("../pages/AttendancePage"));
const CalendarPage = lazy(() => import("../pages/CalendarPage"));
const TasksPage = lazy(() => import("../pages/TasksPage"));
const SalesPage = lazy(() => import("../pages/SalesPage"));
const OperationsPage = lazy(() => import("../pages/OperationsPage"));
const PaymentsPage = lazy(() => import("../pages/PaymentsPage"));
const AccountingPage = lazy(() => import("../pages/AccountingPage"));
const PackagesPage = lazy(() => import("../pages/PackagesPage"));
const CommunicationPage = lazy(() => import("../pages/CommunicationPage"));
const StaffPage = lazy(() => import("../pages/StaffPage"));
const StaffProfilePage = lazy(() => import("../pages/StaffProfilePage"));
const NotificationsPage = lazy(() => import("../pages/NotificationsPage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const SupportPage = lazy(() => import("../pages/SupportPage"));
import { Navigate } from "react-router-dom";

export const appRoutes = [
  { path: "/dashboard", element: <DashboardPage /> },

  { path: "/members", element: <MembersPage /> },
  { path: "/members/:id", element: <MemberProfilePage /> },

  { path: "/attendance", element: <AttendancePage /> },
  { path: "/calendar", element: <CalendarPage /> },
  { path: "/tasks", element: <TasksPage /> },
  { path: "/sales", element: <SalesPage /> },
  { path: "/operations", element: <OperationsPage /> },
  { path: "/payments", element: <PaymentsPage /> },
  { path: "/accounting", element: <AccountingPage /> },
  { path: "/packages", element: <PackagesPage /> },
  { path: "/communication", element: <CommunicationPage /> },
  { path: "/staff", element: <StaffPage /> },
  { path: "/staff/:id", element: <StaffProfilePage /> },
  { path: "/my-profile", element: <StaffProfilePage /> },
  { path: "/notifications", element: <NotificationsPage /> },
  { path: "/settings", element: <SettingsPage /> },
  { path: "/support", element: <SupportPage /> },
  // The log now lives in Settings; an old link still gets there
  { path: "/logs", element: <Navigate to="/settings?section=logs" replace /> },
];
