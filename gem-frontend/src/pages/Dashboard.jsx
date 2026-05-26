import { Avatar, Box, InputAdornment, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import GemTextField from "../components/ui/GemTextField";
import KpiCard from "../components/dashboard/KpiCard";
import GymCalendar from "../components/dashboard/GymCalendar";
import NotificationsPanel from "../components/dashboard/NotificationsPanel";
import TasksTable from "../components/dashboard/TasksTable";
import { useState, useEffect } from "react";
import { getAll as getMembers } from '../services/members.service';
import { getAll as getPayments } from '../services/payments.service';
import { getAll as getExpenses } from '../services/expenses.service';
import { getAll as getNotifications } from '../services/notifications.service';

const fmtFCFA = (n) => `${Math.round(n || 0).toLocaleString('fr-FR')} FCFA`;

function dateFilterStart(filter) {
  const now = new Date();
  if (filter === 'ytd') return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function Dashboard() {
  const [membersFilter, setMembersFilter] = useState("mtd");
  const [revenueFilter, setRevenueFilter] = useState("mtd");
  const [expFilter, setExpFilter] = useState("mtd");
  const [membersList, setMembersList] = useState([]);
  const [paymentsList, setPaymentsList] = useState([]);
  const [expensesList, setExpensesList] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    Promise.all([getMembers(), getPayments(), getExpenses(), getNotifications()])
      .then(([m, p, e, n]) => {
        setMembersList(m.data || []);
        setPaymentsList(p.data || []);
        setExpensesList(e.data || []);
        setNotifications((n.data || []).filter(x => !x.isRead));
      })
      .catch(console.error);
  }, []);

  const countAfter = (items, field, start) =>
    items.filter(item => new Date(item[field]) >= start).length;
  const sumAfter = (items, amtField, dateField, start) =>
    items.filter(item => new Date(item[dateField]) >= start)
      .reduce((s, item) => s + (item[amtField] || 0), 0);

  const membersValue = String(countAfter(membersList, 'createdAt', dateFilterStart(membersFilter)));
  const revenueValue = fmtFCFA(sumAfter(paymentsList, 'amount', 'createdAt', dateFilterStart(revenueFilter)));
  const expValue = fmtFCFA(sumAfter(expensesList, 'amount', 'date', dateFilterStart(expFilter)));

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Here is an overview of your gym
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: { xs: "auto", md: 420 } }}>
          <Box sx={{ flex: 1, display: { xs: "none", md: "block" } }}>
            <GemTextField
              placeholder="what are you looking for?"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Avatar
            sx={{
              width: 38,
              height: 38,
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 0.2,

              bgcolor: "background.paper",
              color: "text.primary",

              border: "1px solid",
              borderColor: "divider",

              boxShadow: "0 10px 22px rgba(15, 23, 42, 0.08)",

              // subtle indigo ring so it matches the theme
              outline: "2px solid rgba(67, 56, 202, 0.22)",
              outlineOffset: 2,
            }}
          >
            ME
          </Avatar>


        </Box>
      </Box>

      {/* Main grid (KPI + Calendar left, Notifications right spanning) */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "1fr minmax(320px, 380px)" },
          gridTemplateRows: { xs: "auto", lg: "auto 1fr" },
          alignItems: "stretch",
        }}
      >
        {/* KPI row */}
        <Box
          sx={{
            gridColumn: { xs: "1 / -1", lg: "1 / 2" },
            gridRow: { lg: "1 / 2" },
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
          }}
        >
          <KpiCard
            title="Total Members"
            value={String(membersValue)}
            filter={membersFilter}
            onFilterChange={setMembersFilter}
          />

          <KpiCard
            title="Total Revenue"
            value={String(revenueValue)}
            filter={revenueFilter}
            onFilterChange={setRevenueFilter}
          />

          <KpiCard
            title="Total Expenditures"
            value={String(expValue)}
            filter={expFilter}
            onFilterChange={setExpFilter}
          />

        </Box>

        {/* Calendar */}
        <Box
          sx={{
            gridColumn: { xs: "1 / -1", lg: "1 / 2" },
            gridRow: { lg: "2 / 3" },
            minHeight: 520,
          }}
        >
          <GymCalendar />
        </Box>

        {/* Notifications spanning both rows */}
        <Box
          sx={{
            gridColumn: { xs: "1 / -1", lg: "2 / 3" },
            gridRow: { lg: "1 / 3" },
          }}
        >
          <NotificationsPanel notifications={notifications} />
        </Box>
      </Box>

      {/* Tasks */}
      <TasksTable />
    </Box>
  );
}
