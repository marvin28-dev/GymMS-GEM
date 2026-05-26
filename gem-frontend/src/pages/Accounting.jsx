// src/pages/Accounting.jsx
import React, { useEffect, useMemo, useState } from "react";

import {
  Box,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Autocomplete,
} from "@mui/material";

import { alpha, useTheme } from "@mui/material/styles";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";

import GemCard from "../components/ui/GemCard";
import GemDialog from "../components/ui/GemDialog";
import GemTextField from "../components/ui/GemTextField";

import {
  PieChart,
  Pie,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const TX_LS_KEY = "gem_accounting_transactions_v1";
const MEMBERS_LS_KEY = "gem_members_v1";
const STAFF_LS_KEY = "gem_staff_v1";

function getJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function createId(prefix = "id") {
  return crypto?.randomUUID?.() || `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmtMoney(n) {
  return Number(n || 0).toLocaleString();
}
function toDate(iso) {
  return new Date((iso || "1970-01-01") + "T00:00:00");
}
function monthKey(iso) {
  const d = toDate(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function monthLabel(ym) {
  const [y, m] = String(ym).split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** ---------------- Filters ---------------- **/
function DateFilter({ value, onChange, width = 180 }) {
  return (
    <TextField
      select
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ width }}
      SelectProps={{ displayEmpty: true }}
    >
      <MenuItem value="30">Filter by Date: Last 30 days</MenuItem>
      <MenuItem value="90">Last 90 days</MenuItem>
      <MenuItem value="180">Last 6 months</MenuItem>
      <MenuItem value="365">Last 12 months</MenuItem>
      <MenuItem value="all">All time</MenuItem>
    </TextField>
  );
}

function applyRangeFilter(rows, rangeValue) {
  if (!rows?.length) return [];
  if (rangeValue === "all") return rows;

  const days = Number(rangeValue);
  if (!Number.isFinite(days)) return rows;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return rows.filter((r) => toDate(r.date) >= cutoff);
}

/** ---------------- Seed data ---------------- **/
function seedTransactionsIfEmpty() {
  const existing = getJSON(TX_LS_KEY, null);
  if (existing?.length) return existing;

  const seed = [
    { id: createId("tx"), date: "2025-11-01", kind: "revenue", source: "MS-Foyet", category: "Membership", amount: 50000, status: "Paid-Cash", note: "Membership payment" },
    { id: createId("tx"), date: "2025-11-01", kind: "revenue", source: "MS-Foyet", category: "Registration", amount: 90000, status: "Paid-Card", note: "New registration" },
    { id: createId("tx"), date: "2025-11-01", kind: "expense", source: "Pay-Jordan", category: "Paystub", amount: 3000, status: "Pending", note: "Staff paystub" },
    { id: createId("tx"), date: "2025-11-01", kind: "revenue", source: "R-Marvin", category: "Registration", amount: 50000, status: "Paid-Cash", note: "Registration payment" },
    { id: createId("tx"), date: "2025-11-01", kind: "expense", source: "Electric Bill", category: "Bills", amount: 90000, status: "Approved", note: "Electricity" },
    { id: createId("tx"), date: "2025-11-01", kind: "revenue", source: "MS-Foyet", category: "Membership", amount: 3000, status: "Paid-Bank", note: "Membership partial" },
    { id: createId("tx"), date: "2025-11-01", kind: "revenue", source: "MS-Foyet", category: "Registration", amount: 50000, status: "Paid-Cash", note: "Registration payment" },
    { id: createId("tx"), date: "2025-11-01", kind: "expense", source: "MS-Foyet", category: "Paystub", amount: 90000, status: "Paid-Bank", note: "Payroll" },
    { id: createId("tx"), date: "2025-11-01", kind: "revenue", source: "MS-Foyet", category: "Registration", amount: 3000, status: "Paid-Bank", note: "Registration top-up" },

    { id: createId("tx"), date: "2026-01-15", kind: "revenue", source: "Membership", category: "Monthly", amount: 15000, status: "Unpaid", note: "Past due member payment" },
    { id: createId("tx"), date: "2026-01-18", kind: "revenue", source: "Other", category: "Session", amount: 8000, status: "Paid", note: "PT session" },
  ];

  setJSON(TX_LS_KEY, seed);
  return seed;
}

/** ---------------- UI helpers ---------------- **/
function KpiCard({ label, value, subLabel }) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        bgcolor: "background.paper",

        // ✅ more breathing room
        px: 2.25,
        py: 1.75,

        // ✅ prevents content from hugging the border
        display: "grid",
        alignContent: "start",
        rowGap: 0.75,

        minHeight: 94,
      }}
    >
      <Typography
        sx={{
          fontWeight: 900,
          fontSize: 12,
          lineHeight: 1.2,
        }}
        color="text.secondary"
      >
        {label}
      </Typography>

      <Typography
        sx={{
          fontWeight: 950,
          fontSize: 24,
          lineHeight: 1.1,
        }}
      >
        {value}
      </Typography>

      {subLabel ? (
        <Typography
          sx={{
            fontWeight: 850,
            fontSize: 12,
            lineHeight: 1.2,
            mt: 0.25, // ✅ keeps it away from the bottom border
          }}
          color="text.secondary"
        >
          {subLabel}
        </Typography>
      ) : null}
    </Box>
  );
}


function RowActionsMenu({ items }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {items.map((it) => (
          <MenuItem
            key={it.label}
            onClick={() => {
              setAnchor(null);
              it.onClick?.();
            }}
            sx={{ fontWeight: 900, ...(it.sx || {}) }}
          >
            {it.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function printOrPdf(title, payload) {
  const html = `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:24px;}
          pre{white-space:pre-wrap;border:1px solid #eee;padding:14px;border-radius:12px;}
          h2{margin:0 0 12px 0;}
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        <pre>${payload}</pre>
        <script>window.focus();window.print();</script>
      </body>
    </html>
  `;
  const w = window.open("", "_blank", "width=980,height=720");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** ---------------- PAGE ---------------- **/
export default function Accounting() {
  const theme = useTheme();

  const [tab, setTab] = useState(0); // 0 Dashboard, 1 Transactions
  const [range, setRange] = useState("30");

  const [tx, setTx] = useState([]);
  const [openReport, setOpenReport] = useState(false);

  // Transactions toolbar + filters
  const [txSearch, setTxSearch] = useState("");
  const [filterType, setFilterType] = useState("all"); // all | income | expense
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAnchor, setFilterAnchor] = useState(null);

  // Create transaction dialog
  const [openCreate, setOpenCreate] = useState(false);

  const incomeCategories = useMemo(() => ["Membership", "Registration", "Products", "Session", "Other"], []);
  const expenseCategories = useMemo(() => ["Paystub", "Bills", "Rent", "Utilities", "Repairs", "Supplies", "Bonus", "Other"], []);

  const [createForm, setCreateForm] = useState({
    date: todayISO(),
    description: "",
    category: "Membership",
    type: "income", // income | expense
    amount: "",
    status: "Paid-Cash",
    memberId: "",
    memberName: "",
    staffId: "",
    staffName: "",
  });

  // Load members/staff for searchable selects
  const [memberOptions, setMemberOptions] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);

  useEffect(() => {
    const seeded = seedTransactionsIfEmpty();
    setTx(seeded);

    const members = getJSON(MEMBERS_LS_KEY, []);
    setMemberOptions(
      (members || []).map((m) => ({
        id: m.id,
        name: m.fullName || m.name || `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown",
      }))
    );

    const staff = getJSON(STAFF_LS_KEY, []);
    setStaffOptions(
      (staff || []).map((s) => ({
        id: s.id,
        name: s.name || "Unknown",
      }))
    );
  }, []);

  // Whenever type changes, force category to valid list (income vs expense)
  useEffect(() => {
    const allowed = createForm.type === "income" ? incomeCategories : expenseCategories;
    if (!allowed.includes(createForm.category)) {
      const nextCat = allowed[0] || "Other";
      setCreateForm((s) => ({
        ...s,
        category: nextCat,
        // reset conditional pickers if category changes due to type flip
        memberId: "",
        memberName: "",
        staffId: "",
        staffName: "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createForm.type]);

  // Keep your existing txFiltered for the dashboard calculations (DO NOT TOUCH dashboard behavior)
  const txFiltered = useMemo(
    () => applyRangeFilter(tx, range).sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [tx, range]
  );

  const totals = useMemo(() => {
    const revenue = txFiltered.filter((t) => t.kind === "revenue").reduce((s, t) => s + Number(t.amount || 0), 0);
    const expense = txFiltered.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount || 0), 0);
    const net = revenue - expense;

    const pastDue = txFiltered
      .filter((t) => t.kind === "revenue" && String(t.status || "").toLowerCase() === "unpaid")
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    return { revenue, expense, net, pastDue };
  }, [txFiltered]);

  const revenuePie = useMemo(() => {
    const map = new Map();
    txFiltered.filter((t) => t.kind === "revenue").forEach((t) => {
      const k = t.category || "Other";
      map.set(k, (map.get(k) || 0) + Number(t.amount || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [txFiltered]);

  const expensePie = useMemo(() => {
    const map = new Map();
    txFiltered.filter((t) => t.kind === "expense").forEach((t) => {
      const k = t.category || "Other";
      map.set(k, (map.get(k) || 0) + Number(t.amount || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [txFiltered]);

  const trend = useMemo(() => {
    const map = new Map();
    txFiltered.forEach((t) => {
      const k = monthKey(t.date);
      if (!map.has(k)) map.set(k, { ym: k, revenue: 0, expense: 0 });
      const row = map.get(k);
      if (t.kind === "revenue") row.revenue += Number(t.amount || 0);
      else row.expense += Number(t.amount || 0);
    });
    return Array.from(map.values())
      .sort((a, b) => String(a.ym).localeCompare(String(b.ym)))
      .map((r) => ({ ...r, label: monthLabel(r.ym) }));
  }, [txFiltered]);

  const generateReportPayload = () => {
    const payload = {
      range,
      totals: {
        totalRevenue: totals.revenue,
        totalExpense: totals.expense,
        netProfit: totals.net,
        pastDuePayments: totals.pastDue,
      },
      topRevenueCategories: [...revenuePie].sort((a, b) => b.value - a.value).slice(0, 6),
      topExpenseCategories: [...expensePie].sort((a, b) => b.value - a.value).slice(0, 6),
      lastTransactions: txFiltered.slice(0, 12),
    };
    return JSON.stringify(payload, null, 2);
  };

  const categoryOptions = useMemo(() => {
    const set = new Set((tx || []).map((t) => t.category).filter(Boolean));
    return ["all", ...Array.from(set).sort((a, b) => String(a).localeCompare(String(b)))];
  }, [tx]);

  const statusOptions = useMemo(() => {
    const set = new Set((tx || []).map((t) => t.status).filter(Boolean));
    const base = Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
    return ["all", ...base];
  }, [tx]);

  const txListFiltered = useMemo(() => {
    const base = applyRangeFilter(tx, range);
    const q = txSearch.trim().toLowerCase();

    return base
      .filter((t) => {
        if (filterType === "all") return true;
        const isIncome = t.kind === "revenue";
        return filterType === "income" ? isIncome : !isIncome;
      })
      .filter((t) => (filterStatus === "all" ? true : String(t.status || "") === filterStatus))
      .filter((t) => (filterCategory === "all" ? true : String(t.category || "") === filterCategory))
      .filter((t) => {
        if (!q) return true;
        const desc = String(t.source || "") + " " + String(t.note || "");
        return (
          String(t.date || "").toLowerCase().includes(q) ||
          String(desc).toLowerCase().includes(q) ||
          String(t.category || "").toLowerCase().includes(q) ||
          String(t.status || "").toLowerCase().includes(q) ||
          String(t.amount || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [tx, range, txSearch, filterType, filterStatus, filterCategory]);

  const handleCreate = () => {
    const baseDesc = createForm.description?.trim();

    let source = baseDesc || "Manual";
    let note = baseDesc || "";

    // Special: membership => use selected member name in Description like MS-Foyet
    if (createForm.category === "Membership" && createForm.memberName) {
      source = `MS-${createForm.memberName.split(" ")[0] || createForm.memberName}`;
      note = baseDesc || `Membership payment - ${createForm.memberName}`;
    }

    // Special: paystub => use selected staff name in Description like Pay-Jordan
    if (createForm.category === "Paystub" && createForm.staffName) {
      source = `Pay-${createForm.staffName.split(" ")[0] || createForm.staffName}`;
      note = baseDesc || `Paystub - ${createForm.staffName}`;
    }

    const nextTx = {
      id: createId("tx"),
      date: createForm.date || todayISO(),
      kind: createForm.type === "income" ? "revenue" : "expense",
      source,
      category: createForm.category || "Other",
      amount: Number(createForm.amount || 0),
      status: createForm.status || "Paid",
      note,
      meta: {
        memberId: createForm.memberId || null,
        staffId: createForm.staffId || null,
      },
    };

    const next = [nextTx, ...(tx || [])];
    setTx(next);
    setJSON(TX_LS_KEY, next);
    setOpenCreate(false);
  };

  const approveExpense = (t) => {
    const ok = window.confirm("Approve this expense? (Manager code gate will be added later)");
    if (!ok) return;

    const next = tx.map((x) => (x.id === t.id ? { ...x, status: "Approved" } : x));
    setTx(next);
    setJSON(TX_LS_KEY, next);
  };

  const statusChip = (status) => {
    const s = String(status || "");
    const low = s.toLowerCase();

    const isBad = low.includes("unpaid") || low.includes("pending");
    const isOk = low.includes("paid") || low.includes("approved");

    const bg = isBad ? "rgba(239,68,68,0.12)" : isOk ? "rgba(34,197,94,0.12)" : "rgba(99,102,241,0.10)";
    const fg = isBad ? "rgb(220,38,38)" : isOk ? "rgb(22,163,74)" : theme.palette.primary.main;
    const br = isBad ? "rgba(239,68,68,0.25)" : isOk ? "rgba(34,197,94,0.25)" : alpha(theme.palette.primary.main, 0.22);

    return (
      <Chip
        size="small"
        label={s || "-"}
        sx={{
          fontWeight: 950,
          bgcolor: bg,
          color: fg,
          border: "1px solid",
          borderColor: br,
        }}
      />
    );
  };

  const createCategoryList = createForm.type === "income" ? incomeCategories : expenseCategories;

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      {/* Title */}
      <Box>
        <Typography sx={{ fontWeight: 950, fontSize: 24 }}>Accounting</Typography>
        <Typography color="text.secondary" sx={{ fontWeight: 800 }}>
          Manage you finances here
        </Typography>
      </Box>

      <GemCard contentSx={{ p: 2 }}>
        {/* Tabs */}
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ "& .MuiTab-root": { fontWeight: 950, textTransform: "none" } }}>
          <Tab label="Dashboard" />
          <Tab label="Transactions" />
        </Tabs>

        <Divider sx={{ my: 1.5 }} />

        {/* IMPORTANT: Dashboard toolbar stays exactly like before */}
        {tab === 0 && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.2, flexWrap: "wrap" }}>
            <DateFilter value={range} onChange={setRange} />
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfRoundedIcon />}
              onClick={() => setOpenReport(true)}
              sx={{ fontWeight: 900 }}
            >
              Generate Report
            </Button>
          </Box>
        )}

        {/* ---------------- DASHBOARD TAB (UNCHANGED) ---------------- */}
        {tab === 0 && (
          <Box sx={{ mt: 2, display: "grid", gap: 2 }}>
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}>
              <KpiCard label="Total Revenue" value={fmtMoney(totals.revenue)} subLabel="XAF" />
              <KpiCard label="Total Expense" value={fmtMoney(totals.expense)} subLabel="XAF" />
              <KpiCard label="Net Profit" value={fmtMoney(totals.net)} subLabel="XAF" />
              <KpiCard label="Past Due Payments" value={fmtMoney(totals.pastDue)} subLabel="XAF" />
            </Box>

            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2 }}>
                <Typography sx={{ fontWeight: 950, mb: 1 }}>Revenue Chart</Typography>
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={revenuePie} dataKey="value" nameKey="name" outerRadius={90} />
                      <ReTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Box>

              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2 }}>
                <Typography sx={{ fontWeight: 950, mb: 1 }}>Expenditure Chart</Typography>
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expensePie} dataKey="value" nameKey="name" outerRadius={90} />
                      <ReTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            </Box>

            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2 }}>
              <Typography sx={{ fontWeight: 950, mb: 1 }}>Revenue - Expense</Typography>
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <ReTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke={theme.palette.primary.main} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="expense" name="Expense" stroke={alpha(theme.palette.text.primary, 0.55)} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          </Box>
        )}

        {/* ---------------- TRANSACTIONS TAB ---------------- */}
        {tab === 1 && (
          <Box sx={{ mt: 0.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                flexWrap: "wrap",
                mb: 1.5,
              }}
            >
              <Box sx={{ width: { xs: "100%", sm: 260 } }}>
                <GemTextField
                  placeholder="Search"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Button
                  variant="outlined"
                  startIcon={<FilterListRoundedIcon />}
                  onClick={(e) => setFilterAnchor(e.currentTarget)}
                  sx={{ fontWeight: 900 }}
                >
                  Filter by
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<PictureAsPdfRoundedIcon />}
                  onClick={() => setOpenReport(true)}
                  sx={{ fontWeight: 900 }}
                >
                  Generate Report
                </Button>

                <Button
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  onClick={() => {
                    setCreateForm({
                      date: todayISO(),
                      description: "",
                      type: "income",
                      category: incomeCategories[0] || "Membership",
                      amount: "",
                      status: "Paid-Cash",
                      memberId: "",
                      memberName: "",
                      staffId: "",
                      staffName: "",
                    });
                    setOpenCreate(true);
                  }}
                  sx={{ fontWeight: 950 }}
                >
                  Create New Transaction
                </Button>
              </Box>
            </Box>

            <Menu
              anchorEl={filterAnchor}
              open={Boolean(filterAnchor)}
              onClose={() => setFilterAnchor(null)}
              PaperProps={{
                sx: {
                  borderRadius: 3,
                  p: 1.5,
                  width: 320,
                },
              }}
            >
              <Box sx={{ px: 1, pb: 0.5 }}>
                <Typography sx={{ fontWeight: 950, mb: 1 }}>Filters</Typography>

                <Box sx={{ mb: 1.3 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 12, mb: 0.6 }} color="text.secondary">
                    Date
                  </Typography>
                  <DateFilter value={range} onChange={setRange} width="100%" />
                </Box>

                <Box sx={{ mb: 1.3 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 12, mb: 0.6 }} color="text.secondary">
                    Type
                  </Typography>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="income">Income</MenuItem>
                    <MenuItem value="expense">Expense</MenuItem>
                  </TextField>
                </Box>

                <Box sx={{ mb: 1.3 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 12, mb: 0.6 }} color="text.secondary">
                    Status
                  </Typography>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    {statusOptions.map((s) => (
                      <MenuItem key={s} value={s}>
                        {s === "all" ? "All" : s}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                <Box sx={{ mb: 1.2 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 12, mb: 0.6 }} color="text.secondary">
                    Category
                  </Typography>
                  <TextField
                    select
                    size="small"
                    fullWidth
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    {categoryOptions.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c === "all" ? "All" : c}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                <Divider sx={{ my: 1.2 }} />

                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    sx={{ fontWeight: 900 }}
                    onClick={() => {
                      setRange("30");
                      setFilterType("all");
                      setFilterStatus("all");
                      setFilterCategory("all");
                      setFilterAnchor(null);
                    }}
                  >
                    Reset
                  </Button>
                  <Button fullWidth variant="contained" sx={{ fontWeight: 950 }} onClick={() => setFilterAnchor(null)}>
                    Apply
                  </Button>
                </Box>
              </Box>
            </Menu>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {txListFiltered.map((t) => {
                    const isIncome = t.kind === "revenue";
                    const desc = t.source || t.note || "-";
                    return (
                      <TableRow key={t.id} sx={{ "& td": { borderBottom: "1px solid", borderColor: "divider" } }}>
                        <TableCell>{t.date}</TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>
                          <Typography noWrap title={`${t.source || ""}${t.note ? ` — ${t.note}` : ""}`}>
                            {desc}
                          </Typography>
                        </TableCell>
                        <TableCell>{t.category}</TableCell>
                        <TableCell sx={{ fontWeight: 950, color: isIncome ? "success.main" : "error.main" }}>
                          {isIncome ? "Income" : "Expense"}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 950 }}>{fmtMoney(t.amount)} XAF</TableCell>
                        <TableCell>{statusChip(t.status)}</TableCell>
                        <TableCell align="right">
                          <RowActionsMenu
                            items={[
                              { label: "View details", onClick: () => alert(JSON.stringify(t, null, 2)) },
                              ...(t.kind === "expense" ? [{ label: "Approve expense", onClick: () => approveExpense(t) }] : []),
                              { label: "Print", onClick: () => printOrPdf("Transaction", JSON.stringify(t, null, 2)) },
                              { label: "Download PDF", onClick: () => printOrPdf("Transaction (PDF)", JSON.stringify(t, null, 2)) },
                              {
                                label: "Toggle Paid/Unpaid",
                                onClick: () => {
                                  const next = tx.map((x) => {
                                    if (x.id !== t.id) return x;
                                    const low = String(x.status || "").toLowerCase();
                                    const isUnpaid = low === "unpaid";
                                    return { ...x, status: isUnpaid ? "Paid-Cash" : "Unpaid" };
                                  });
                                  setTx(next);
                                  setJSON(TX_LS_KEY, next);
                                },
                              },
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {txListFiltered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
                          <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                            No transactions found for this filter.
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </GemCard>

      {/* REPORT DIALOG (unchanged) */}
      <GemDialog open={openReport} onClose={() => setOpenReport(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 950 }}>Generated Report</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography color="text.secondary" sx={{ fontWeight: 800, mb: 1 }}>
            Summary for selected date range.
          </Typography>

          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              p: 1.5,
              bgcolor: "rgba(15,23,42,0.03)",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              fontSize: 12,
              maxHeight: 360,
              overflow: "auto",
            }}
          >
            {generateReportPayload()}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenReport(false)} sx={{ fontWeight: 900 }}>
            Close
          </Button>
          <Button variant="contained" sx={{ fontWeight: 950 }} onClick={() => printOrPdf("Accounting Report", generateReportPayload())}>
            Print / Save as PDF
          </Button>
        </DialogActions>
      </GemDialog>

      {/* CREATE TRANSACTION DIALOG (alignment fixed + conditional searches + category by type) */}
      <GemDialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 950 }}>Create New Transaction</DialogTitle>

        <DialogContent sx={{ pt: 2.5, display: "grid", gap: 2 }}>
          <TextField
            label="Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={createForm.date}
            onChange={(e) => setCreateForm((s) => ({ ...s, date: e.target.value }))}
            fullWidth
          />

          <TextField
            label="Description"
            size="small"
            value={createForm.description}
            onChange={(e) => setCreateForm((s) => ({ ...s, description: e.target.value }))}
            fullWidth
          />

          {/* TYPE + AMOUNT (alignment fixed by using TextField select) */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              alignItems: "start",
            }}
          >
            <TextField
              label="Type"
              select
              size="small"
              value={createForm.type}
              onChange={(e) =>
                setCreateForm((s) => ({
                  ...s,
                  type: e.target.value,
                  // reset dependent fields when switching type
                  category: e.target.value === "income" ? incomeCategories[0] : expenseCategories[0],
                  memberId: "",
                  memberName: "",
                  staffId: "",
                  staffName: "",
                }))
              }
              fullWidth
            >
              <MenuItem value="income">Income</MenuItem>
              <MenuItem value="expense">Expense</MenuItem>
            </TextField>

            <TextField
              label="Amount (XAF)"
              size="small"
              type="number"
              value={createForm.amount}
              onChange={(e) => setCreateForm((s) => ({ ...s, amount: e.target.value }))}
              fullWidth
            />
          </Box>

          {/* CATEGORY + STATUS */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              alignItems: "start",
            }}
          >
            <TextField
              label="Category"
              select
              size="small"
              value={createForm.category}
              onChange={(e) => {
                const nextCat = e.target.value;
                setCreateForm((s) => ({
                  ...s,
                  category: nextCat,
                  // reset conditional pickers when category changes
                  memberId: nextCat === "Membership" ? s.memberId : "",
                  memberName: nextCat === "Membership" ? s.memberName : "",
                  staffId: nextCat === "Paystub" ? s.staffId : "",
                  staffName: nextCat === "Paystub" ? s.staffName : "",
                }));
              }}
              fullWidth
            >
              {createCategoryList.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Status"
              select
              size="small"
              value={createForm.status}
              onChange={(e) => setCreateForm((s) => ({ ...s, status: e.target.value }))}
              fullWidth
            >
              <MenuItem value="Paid-Cash">Paid-Cash</MenuItem>
              <MenuItem value="Paid-Card">Paid-Card</MenuItem>
              <MenuItem value="Paid-Bank">Paid-Bank</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="Approved">Approved</MenuItem>
              <MenuItem value="Unpaid">Unpaid</MenuItem>
              <MenuItem value="Paid">Paid</MenuItem>
            </TextField>
          </Box>

          {/* CONDITIONAL: Membership -> member search */}
          {createForm.category === "Membership" && (
            <Autocomplete
              size="small"
              options={memberOptions}
              getOptionLabel={(opt) => opt?.name || ""}
              value={
                createForm.memberId
                  ? { id: createForm.memberId, name: createForm.memberName || "" }
                  : null
              }
              onChange={(_, v) => {
                setCreateForm((s) => ({
                  ...s,
                  memberId: v?.id || "",
                  memberName: v?.name || "",
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search member"
                  placeholder="Type member name..."
                  fullWidth
                />
              )}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
            />
          )}

          {/* CONDITIONAL: Paystub -> staff search */}
          {createForm.category === "Paystub" && (
            <Autocomplete
              size="small"
              options={staffOptions}
              getOptionLabel={(opt) => opt?.name || ""}
              value={
                createForm.staffId
                  ? { id: createForm.staffId, name: createForm.staffName || "" }
                  : null
              }
              onChange={(_, v) => {
                setCreateForm((s) => ({
                  ...s,
                  staffId: v?.id || "",
                  staffName: v?.name || "",
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search staff"
                  placeholder="Type staff name..."
                  fullWidth
                />
              )}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
            />
          )}

          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
            Manager approval gate will be wired later (for expenses).
          </Typography>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCreate(false)} sx={{ fontWeight: 900 }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} sx={{ fontWeight: 950 }}>
            Create
          </Button>
        </DialogActions>
      </GemDialog>
    </Box>
  );
}
