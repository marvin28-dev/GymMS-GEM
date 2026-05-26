// src/pages/Staff.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Avatar,
  Box,
  Divider,
  FormControl,
  IconButton,
  Menu,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  InputAdornment,
} from "@mui/material";

import { alpha, useTheme } from "@mui/material/styles";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import MoreVertIcon from "@mui/icons-material/MoreVert";

import GemCard from "../components/ui/GemCard";
import GemTextField from "../components/ui/GemTextField";

const STAFF_LS_KEY = "gem_staff_v1";
const STAFF_PAYSTUBS_LS_KEY = "gem_staff_paystubs_v1";

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
function initialsFromName(name = "") {
  const parts = String(name).trim().split(" ").filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase() || "ST";
}
function fmtMoney(n) {
  return Number(n || 0).toLocaleString();
}
function formatPeriodLabel(startISO, endISO) {
  const fmt = (iso) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(startISO)} - ${fmt(endISO)}`;
}

/** Last 6 pay periods based on 20th → 20th (monthly). */
function getLast6PayPeriods() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  let end = new Date(year, month, 20);
  if (day < 20) end = new Date(year, month - 1, 20);

  const periods = [];
  for (let i = 0; i < 6; i += 1) {
    const endDate = new Date(end.getFullYear(), end.getMonth(), 20);
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 20);

    const startISO = startDate.toISOString().slice(0, 10);
    const endISO = endDate.toISOString().slice(0, 10);

    periods.push({
      key: `${startISO}|${endISO}`,
      startISO,
      endISO,
      label: formatPeriodLabel(startISO, endISO),
    });

    end = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 20);
  }

  return periods;
}

function seedStaffIfEmpty() {
  const existing = getJSON(STAFF_LS_KEY, []);
  if (existing?.length) return existing;

  const seeded = [
    { id: createId("st"), name: "Marvin Ekokobe", schedule: "Mon, Tues, Thurs", contact: "3439889766", role: "Cleaner", lastPunch: "2024-12-21 08:25" },
    { id: createId("st"), name: "John Doe", schedule: "Mon, Wed, Thurs", contact: "3439889766", role: "Coach", lastPunch: "2024-12-21 08:25" },
    { id: createId("st"), name: "Mary Lopez", schedule: "Sun, Mon, Tues", contact: "3439889766", role: "Coach", lastPunch: "2024-12-21 08:25" },
    { id: createId("st"), name: "John Carter", schedule: "Mon, Tues, Thurs", contact: "3439889766", role: "Coach", lastPunch: "2024-12-21 08:25" },
    { id: createId("st"), name: "Bechem Coustin", schedule: "Mon, Tues, Thurs", contact: "3439889766", role: "Cleaner", lastPunch: "2024-12-21 08:25" },
    { id: createId("st"), name: "Foyet Loic", schedule: "Mon, Tues, Thurs", contact: "3439889766", role: "Coach", lastPunch: "2024-12-21 08:25" },
    { id: createId("st"), name: "Newguy Stephen", schedule: "Mon, Tues, Thurs", contact: "3439889766", role: "Coach", lastPunch: "2024-12-21 08:25" },
    { id: createId("st"), name: "Jenifer Lopez", schedule: "Mon, Tues, Thurs", contact: "3439889766", role: "Coach", lastPunch: "2024-12-21 08:25" },
    { id: createId("st"), name: "Swag Lee", schedule: "Mon, Tues, Thurs", contact: "3439889766", role: "Coach", lastPunch: "2024-12-21 08:25" },
  ];

  setJSON(STAFF_LS_KEY, seeded);
  return seeded;
}

function seedPaystubsIfEmpty(staff) {
  const existing = getJSON(STAFF_PAYSTUBS_LS_KEY, null);
  if (existing?.rows?.length) return existing;

  const periods = getLast6PayPeriods();
  const rows = [];

  staff.forEach((s, i) => {
    periods.forEach((p, j) => {
      const rate = [500, 600, 700, 1000, 1300, 2500][(i + j) % 6];
      const hours = [10, 12, 14, 16, 17, 19, 21, 40, 43][(i + j) % 9];
      const amount = rate * hours;
      const status = (i + j) % 3 === 0 ? "Unpaid" : "Paid";

      rows.push({
        id: createId("ps"),
        staffId: s.id,
        staffName: s.name,
        periodKey: p.key,
        periodLabel: p.label,
        ratePerHr: rate,
        totalHours: hours,
        payStub: amount,
        status,
      });
    });
  });

  const payload = { rows };
  setJSON(STAFF_PAYSTUBS_LS_KEY, payload);
  return payload;
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

function StatusChip({ status }) {
  const s = String(status || "").toLowerCase();
  const paid = s === "paid";
  return (
    <Chip
      size="small"
      label={paid ? "Paid" : "Unpaid"}
      sx={{
        fontWeight: 950,
        bgcolor: paid ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        color: paid ? "rgb(22,163,74)" : "rgb(220,38,38)",
        border: "1px solid",
        borderColor: paid ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
      }}
    />
  );
}

export default function Staff() {
  const navigate = useNavigate();
  const theme = useTheme();

  const [tab, setTab] = useState(0);

  const [staff, setStaff] = useState([]);
  const [searchStaff, setSearchStaff] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [paySearch, setPaySearch] = useState("");
  const [periods] = useState(() => getLast6PayPeriods());
  const [periodFilter, setPeriodFilter] = useState(periods[0]?.key || "");
  const [paystubData, setPaystubData] = useState({ rows: [] });

  useEffect(() => {
    const s = seedStaffIfEmpty();
    setStaff(s);

    const ps = seedPaystubsIfEmpty(s);
    setPaystubData(ps);
  }, []);

  const staffFiltered = useMemo(() => {
    const q = searchStaff.trim().toLowerCase();
    return staff
      .filter((s) => (roleFilter === "all" ? true : String(s.role || "").toLowerCase() === roleFilter))
      .filter((s) => {
        if (!q) return true;
        return (
          String(s.name || "").toLowerCase().includes(q) ||
          String(s.contact || "").toLowerCase().includes(q) ||
          String(s.schedule || "").toLowerCase().includes(q)
        );
      });
  }, [staff, searchStaff, roleFilter]);

  const paystubsFiltered = useMemo(() => {
    const q = paySearch.trim().toLowerCase();
    return (paystubData.rows || [])
      .filter((r) => (periodFilter ? r.periodKey === periodFilter : true))
      .filter((r) => {
        if (!q) return true;
        return (
          String(r.staffName || "").toLowerCase().includes(q) ||
          String(r.ratePerHr || "").toLowerCase().includes(q) ||
          String(r.status || "").toLowerCase().includes(q)
        );
      });
  }, [paystubData, paySearch, periodFilter]);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography sx={{ fontWeight: 950, fontSize: 24 }}>Staff</Typography>
        <Typography color="text.secondary" sx={{ fontWeight: 800 }}>
          Here is where you manage your Staff
        </Typography>
      </Box>

      <GemCard contentSx={{ p: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ "& .MuiTab-root": { fontWeight: 950, textTransform: "none" } }}
        >
          <Tab label="STAFF LIST" />
          <Tab label="PAY STUBS" />
        </Tabs>

        <Divider sx={{ my: 1.5 }} />

        {/* TAB 0 */}
        {tab === 0 && (
          <Box sx={{ display: "grid", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
              <Box sx={{ width: { xs: "100%", sm: 260 } }}>
                <GemTextField
                  placeholder="search staff"
                  value={searchStaff}
                  onChange={(e) => setSearchStaff(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <FormControl size="small" sx={{ width: 200 }}>
                <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} sx={{ fontWeight: 900 }}>
                  <MenuItem value="all">Filter by</MenuItem>
                  <MenuItem value="coach">Coach</MenuItem>
                  <MenuItem value="cleaner">Cleaner</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Name</TableCell>
                    <TableCell>Schedule</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Last Punch</TableCell>
                    <TableCell>Position</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {staffFiltered.map((s) => {
                    const initials = initialsFromName(s.name);
                    return (
                      <TableRow
                        key={s.id}
                        hover
                        sx={{ cursor: "pointer", "& td": { borderBottom: "1px solid", borderColor: "divider" } }}
                        onClick={() => navigate(`/staff/${s.id}`)} // ✅ SINGLE SOURCE OF TRUTH
                      >
                        <TableCell sx={{ width: 52 }}>
                          <Avatar
                            sx={{
                              width: 34,
                              height: 34,
                              fontWeight: 950,
                              bgcolor: alpha(theme.palette.primary.main, 0.12),
                              color: theme.palette.primary.main,
                              border: "1px solid",
                              borderColor: alpha(theme.palette.primary.main, 0.22),
                            }}
                          >
                            {initials}
                          </Avatar>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>{s.name}</TableCell>
                        <TableCell>{s.schedule}</TableCell>
                        <TableCell>{s.contact}</TableCell>
                        <TableCell>{s.lastPunch}</TableCell>
                        <TableCell>{s.role}</TableCell>

                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <RowActionsMenu
                            items={[
                              { label: "View profile", onClick: () => navigate(`/staff/${s.id}`) }, // ✅ FIXED
                              { label: "Edit (later)", onClick: () => alert("Edit staff later") },
                            ]}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {staffFiltered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
                          <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                            No staff found.
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

        {/* TAB 1 */}
        {tab === 1 && (
          <Box sx={{ display: "grid", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
              <Box sx={{ width: { xs: "100%", sm: 260 } }}>
                <GemTextField
                  placeholder="search staff"
                  value={paySearch}
                  onChange={(e) => setPaySearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <FormControl size="small" sx={{ width: 260 }}>
                <Select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} sx={{ fontWeight: 900 }}>
                  {periods.map((p) => (
                    <MenuItem key={p.key} value={p.key}>
                      {p.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Rate/ Hr</TableCell>
                    <TableCell>Total Hours</TableCell>
                    <TableCell>Pay Stub</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {paystubsFiltered.map((r) => (
                    <TableRow key={r.id} sx={{ "& td": { borderBottom: "1px solid", borderColor: "divider" } }}>
                      <TableCell sx={{ fontWeight: 900 }}>{r.staffName}</TableCell>
                      <TableCell>{fmtMoney(r.ratePerHr)}</TableCell>
                      <TableCell>{r.totalHours}</TableCell>
                      <TableCell sx={{ fontWeight: 950 }}>{fmtMoney(r.payStub)}</TableCell>
                      <TableCell>
                        <StatusChip status={r.status} />
                      </TableCell>
                      <TableCell align="right">
                        <RowActionsMenu
                          items={[
                            { label: "View staff profile", onClick: () => navigate(`/staff/${r.staffId}`) }, // ✅ handy
                            { label: "View pay (later)", onClick: () => alert(JSON.stringify(r, null, 2)) },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}

                  {paystubsFiltered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
                          <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                            No pay stubs found for this pay period.
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
    </Box>
  );
}
