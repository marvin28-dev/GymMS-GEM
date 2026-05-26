// src/routes/routeConfig.jsx
import DashboardPage from "../pages/DashboardPage";
import MembersPage from "../pages/MembersPage";
import MemberProfilePage from "../pages/MemberProfilePage";
import AttendancePage from "../pages/AttendancePage";
import CalendarPage from "../pages/CalendarPage";
import TasksPage from "../pages/TasksPage";
import SalesPage from "../pages/SalesPage";
import OperationsPage from "../pages/OperationsPage";
import PaymentsPage from "../pages/PaymentsPage";
import AccountingPage from "../pages/AccountingPage";
import PackagesPage from "../pages/PackagesPage";
import CommunicationPage from "../pages/CommunicationPage";
import StaffPage from "../pages/StaffPage";
import StaffProfilePage from "../pages/StaffProfilePage";
import NotificationsPage from "../pages/NotificationsPage";
import SettingsPage from "../pages/SettingsPage";

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
  { path: "/notifications", element: <NotificationsPage /> },
  { path: "/settings", element: <SettingsPage /> },
];
