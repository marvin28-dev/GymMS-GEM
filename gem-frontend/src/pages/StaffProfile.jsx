// src/pages/StaffProfile.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { alpha, useTheme } from "@mui/material/styles";

import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  Menu,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddRoundedIcon from "@mui/icons-material/AddRounded";

import GemCard from "../components/ui/GemCard";
import GemDialog from "../components/ui/GemDialog";

const STAFF_LS_KEY = "gem_staff_v1";

const STAFF_EVENTS_KEY = (id) => `gem_staff_events_v1_${id}`;
const STAFF_ATTENDANCE_KEY = (id) => `gem_staff_attendance_v1_${id}`;
const STAFF_FINANCIALS_KEY = (id) => `gem_staff_financials_v1_${id}`;

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
function fmtDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString();
  } catch {
    return iso;
  }
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nowTimeHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function minutesBetween(t1, t2) {
  // "08:24" -> minutes
  const toM = (t) => {
    const [h, m] = String(t || "0:0").split(":").map((x) => Number(x || 0));
    return h * 60 + m;
  };
  const a = toM(t1);
  const b = toM(t2);
  return Math.max(0, b - a);
}
function hoursFloat(mins) {
  return Math.round((mins / 60) * 100) / 100;
}

/** ----- date filter helper ----- */
function applyDateFilter(rows, filterValue) {
  if (!rows?.length) return [];
  if (filterValue === "all") return rows;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = (iso) => new Date((iso || "1970-01-01") + "T00:00:00");

  if (filterValue === "month") {
    return rows.filter((r) => toDate(r.date) >= startOfMonth);
  }
  if (filterValue === "today") {
    const t = todayISO();
    return rows.filter((r) => r.date === t);
  }
  if (filterValue === "7") {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return rows.filter((r) => toDate(r.date) >= cutoff);
  }
  return rows;
}

function DateFilter({ value, onChange, width = 170 }) {
  return (
    <FormControl size="small" sx={{ width }}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} sx={{ fontWeight: 900 }}>
        <MenuItem value="all">Filter by Date</MenuItem>
        <MenuItem value="today">Today</MenuItem>
        <MenuItem value="7">Last 7 days</MenuItem>
        <MenuItem value="month">This month</MenuItem>
      </Select>
    </FormControl>
  );
}

/** ----- Calendar helpers (simple month grid) ----- */
function startOfMonth(dateObj) {
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
}
function endOfMonth(dateObj) {
  return new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0);
}
function addMonths(dateObj, delta) {
  return new Date(dateObj.getFullYear(), dateObj.getMonth() + delta, 1);
}
function isoFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function monthTitle(dateObj) {
  return dateObj.toLocaleDateString(undefined, { month: "long", year: "numeric" }).toUpperCase();
}
function getMonthGrid(dateObj) {
  // returns array of 42 cells (6 weeks x 7)
  const start = startOfMonth(dateObj);
  const end = endOfMonth(dateObj);

  const startDay = start.getDay(); // 0 Sun
  const totalDays = end.getDate();

  const cells = [];
  // previous month padding
  for (let i = 0; i < startDay; i += 1) cells.push({ type: "pad", date: null });

  for (let d = 1; d <= totalDays; d += 1) {
    const dt = new Date(dateObj.getFullYear(), dateObj.getMonth(), d);
    cells.push({ type: "day", date: dt, iso: isoFromDate(dt) });
  }
  while (cells.length < 42) cells.push({ type: "pad", date: null });
  return cells;
}

/** ----- seed data if missing ----- */
function ensureStaffSeeds(staffId, staffName) {
  // EVENTS
  const existingEvents = getJSON(STAFF_EVENTS_KEY(staffId), null);
  if (!existingEvents) {
    setJSON(STAFF_EVENTS_KEY(staffId), [
      { id: createId("ev"), date: todayISO(), title: "Schedule: Morning shift", start: "08:00", end: "12:00" },
      { id: createId("ev"), date: todayISO(), title: "Task: Clean equipment", start: "14:00", end: "15:00" },
    ]);
  }

  // ATTENDANCE
  const existingAtt = getJSON(STAFF_ATTENDANCE_KEY(staffId), null);
  if (!existingAtt) {
    setJSON(STAFF_ATTENDANCE_KEY(staffId), [
      { id: createId("p"), no: 13, date: "2025-11-12", in: "08:24", out: "20:24", hours: 12 },
      { id: createId("p"), no: 12, date: "2025-11-10", in: "08:24", out: "20:24", hours: 12 },
      { id: createId("p"), no: 11, date: "2025-11-08", in: "08:24", out: "20:24", hours: 12 },
    ]);
  }

  // FINANCIALS
  const existingFin = getJSON(STAFF_FINANCIALS_KEY(staffId), null);
  if (!existingFin) {
    const rows = [
      { date: "2025-11-12", payPeriod: "20/09/21-20/10/21", hoursWorked: 24, hourlyRate: 2500, bonus: 0 },
      { date: "2025-11-12", payPeriod: "20/10/21-20/11/21", hoursWorked: 24, hourlyRate: 2500, bonus: 5000 },
      { date: "2025-11-12", payPeriod: "20/09/21-20/10/21", hoursWorked: 24, hourlyRate: 2500, bonus: 0 },
      { date: "2025-11-12", payPeriod: "20/10/21-20/11/21", hoursWorked: 24, hourlyRate: 2500, bonus: 5000 },
      { date: "2025-11-12", payPeriod: "20/09/21-20/10/21", hoursWorked: 24, hourlyRate: 2500, bonus: 0 },
    ].map((r) => ({
      id: createId("fin"),
      ...r,
      amountPaid: r.hoursWorked * r.hourlyRate + r.bonus,
      staffName,
    }));

    setJSON(STAFF_FINANCIALS_KEY(staffId), rows);
  }
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

/** ---------------- PAGE ---------------- */
export default function StaffProfile() {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const [staff, setStaff] = useState(null);

  // Left-side "details" (mock for now)
  const [profileDetails, setProfileDetails] = useState({
    status: "Active Staff",
    role: "Coach",
    email: "efuetngu38@gmail.com",
    address: "Centre D'handicap",
    phone: "3439889755",
    checkingCode: "12**",
    emergencyContact: "3439889755",
    dateJoined: "2025-12-12",
  });

  // Calendar
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDayISO, setSelectedDayISO] = useState(todayISO());
  const [eventFilter, setEventFilter] = useState("all");
  const [events, setEvents] = useState([]);

  const [openAddEvent, setOpenAddEvent] = useState(false);
  const [eventForm, setEventForm] = useState({ date: todayISO(), title: "", start: "08:00", end: "09:00" });

  // Attendance
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [attendance, setAttendance] = useState([]);
  const [openAddPunch, setOpenAddPunch] = useState(false);
  const [punchForm, setPunchForm] = useState({ date: todayISO(), in: nowTimeHHMM(), out: nowTimeHHMM() });

  // Financials
  const [financials, setFinancials] = useState([]);

  // Load everything
  useEffect(() => {
    const list = getJSON(STAFF_LS_KEY, []);
    const found = (list || []).find((x) => String(x.id) === String(staffId));
    if (!found) {
      setStaff(null);
      return;
    }
    setStaff(found);

    ensureStaffSeeds(found.id, found.name);

    setEvents(getJSON(STAFF_EVENTS_KEY(found.id), []));
    setAttendance(getJSON(STAFF_ATTENDANCE_KEY(found.id), []));
    setFinancials(getJSON(STAFF_FINANCIALS_KEY(found.id), []));

    // If later you store real staff profile details, you can load them here as well.
  }, [staffId]);

  const initials = staff ? initialsFromName(staff.name) : "ST";

  // calendar derived
  const monthCells = useMemo(() => getMonthGrid(monthCursor), [monthCursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    (events || []).forEach((ev) => {
      const k = ev.date;
      map.set(k, (map.get(k) || 0) + 1);
    });
    return map;
  }, [events]);

  const filteredEvents = useMemo(() => {
    const rows = (events || []).map((e) => ({ ...e, date: e.date }));
    return applyDateFilter(rows, eventFilter).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [events, eventFilter]);

  const filteredAttendance = useMemo(() => {
    const rows = (attendance || []).map((a) => ({ ...a, date: a.date }));
    return applyDateFilter(rows, attendanceFilter).sort((a, b) => Number(b.no || 0) - Number(a.no || 0));
  }, [attendance, attendanceFilter]);

  if (!staff) {
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        <GemCard contentSx={{ p: 3 }}>
          <Typography sx={{ fontWeight: 950, fontSize: 18 }}>Staff not found</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            This staff ID doesn’t exist in your local data.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={() => navigate("/staff")} sx={{ fontWeight: 900 }}>
              Back to Staff
            </Button>
          </Box>
        </GemCard>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
        alignItems: "start",
      }}
    >
      {/* LEFT SUMMARY */}
      <GemCard contentSx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <IconButton
            onClick={() => navigate(-1)}
            aria-label="Close staff profile"
            size="small"
            sx={{
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: 1,
              "&:hover": { bgcolor: "background.paper" },
            }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          <Box sx={{ position: "relative" }}>
            <Avatar
              sx={{
                width: 84,
                height: 84,
                fontSize: 24,
                fontWeight: 950,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: theme.palette.primary.main,
                border: "1px solid",
                borderColor: alpha(theme.palette.primary.main, 0.22),
              }}
            >
              {initials}
            </Avatar>
          </Box>
        </Box>

        <Box sx={{ textAlign: "center", mt: 1.2 }}>
          <Typography sx={{ fontWeight: 950, fontSize: 20 }}>{staff.name}</Typography>

          <Chip
            label={profileDetails.status}
            size="small"
            sx={{
              mt: 0.8,
              fontWeight: 900,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
            }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: "grid", gap: 1.2 }}>
          <InfoRow label="Role" value={profileDetails.role} />
          <InfoRow label="Email" value={profileDetails.email} />
          <InfoRow label="Address" value={profileDetails.address} />
          <InfoRow label="Phone Number" value={profileDetails.phone} />

          <InfoRow
            label="Checking Code"
            value={profileDetails.checkingCode}
            rightIcon="👁️"
            onRightIconClick={() => alert("We’ll add secure reveal later.")}
          />

          <InfoRow label="Emergency Contact" value={profileDetails.emergencyContact} />
          <InfoRow label="Date Joined" value={fmtDate(profileDetails.dateJoined)} />
        </Box>
      </GemCard>

      {/* RIGHT CONTENT */}
      <Box sx={{ display: "grid", gap: 2 }}>
        {/* CALENDAR */}
        <GemCard contentSx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <IconButton size="small" onClick={() => setMonthCursor((m) => addMonths(m, -1))}>
                <ChevronLeftRoundedIcon />
              </IconButton>
              <Typography sx={{ fontWeight: 950 }}>{monthTitle(monthCursor)}</Typography>
              <IconButton size="small" onClick={() => setMonthCursor((m) => addMonths(m, 1))}>
                <ChevronRightRoundedIcon />
              </IconButton>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                startIcon={<AddRoundedIcon />}
                onClick={() => {
                  setEventForm({ date: selectedDayISO || todayISO(), title: "", start: "08:00", end: "09:00" });
                  setOpenAddEvent(true);
                }}
                sx={{ fontWeight: 900 }}
              >
                Add Event
              </Button>
              <DateFilter value={eventFilter} onChange={setEventFilter} />
            </Box>
          </Box>

          {/* Month grid */}
          <Box sx={{ mt: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                bgcolor: "rgba(15,23,42,0.03)",
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                <Box key={d} sx={{ p: 1, textAlign: "center" }}>
                  <Typography sx={{ fontWeight: 950, fontSize: 12 }}>{d}</Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {monthCells.map((c, idx) => {
                const isSelected = c.iso && c.iso === selectedDayISO;
                const hasEvents = c.iso && eventsByDay.get(c.iso);

                return (
                  <Box
                    key={idx}
                    onClick={() => c.iso && setSelectedDayISO(c.iso)}
                    sx={{
                      height: 54,
                      borderRight: (idx + 1) % 7 === 0 ? "none" : "1px solid",
                      borderBottom: idx >= 35 ? "none" : "1px solid",
                      borderColor: "divider",
                      p: 1,
                      cursor: c.iso ? "pointer" : "default",
                      bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.10) : "transparent",
                      position: "relative",
                    }}
                  >
                    {c.type === "day" ? (
                      <>
                        <Typography sx={{ fontWeight: 900, fontSize: 12 }}>{c.date.getDate()}</Typography>
                        {hasEvents ? (
                          <Box
                            sx={{
                              position: "absolute",
                              bottom: 8,
                              left: 10,
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              bgcolor: theme.palette.primary.main,
                              opacity: 0.9,
                            }}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Optional: list events under calendar (you can remove later) */}
          <Box sx={{ mt: 1.5 }}>
            {filteredEvents.slice(0, 4).map((ev) => (
              <Box key={ev.id} sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 0.6 }}>
                <Typography sx={{ fontWeight: 900, fontSize: 13 }}>
                  {fmtDate(ev.date)} • {ev.start}-{ev.end}
                </Typography>
                <Typography color="text.secondary" sx={{ fontWeight: 800, fontSize: 13 }}>
                  {ev.title}
                </Typography>
              </Box>
            ))}
          </Box>
        </GemCard>

        {/* ATTENDANCE */}
        <GemCard contentSx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 950 }}>Attendance</Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                startIcon={<AddRoundedIcon />}
                onClick={() => {
                  setPunchForm({ date: todayISO(), in: nowTimeHHMM(), out: nowTimeHHMM() });
                  setOpenAddPunch(true);
                }}
                sx={{ fontWeight: 900 }}
              >
                Add Punch
              </Button>

              <DateFilter value={attendanceFilter} onChange={setAttendanceFilter} />
            </Box>
          </Box>

          <Box sx={{ mt: 1.5 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>NO</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Punch In</TableCell>
                    <TableCell>Punch Out</TableCell>
                    <TableCell>Hours</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredAttendance.map((a) => (
                    <TableRow key={a.id} sx={{ "& td": { borderBottom: "1px solid", borderColor: "divider" } }}>
                      <TableCell sx={{ fontWeight: 900 }}>{a.no}</TableCell>
                      <TableCell>{fmtDate(a.date)}</TableCell>
                      <TableCell>{a.in}</TableCell>
                      <TableCell>{a.out}</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>{a.hours}</TableCell>
                    </TableRow>
                  ))}

                  {filteredAttendance.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}>
                          <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                            No punches found for this filter.
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </GemCard>

        {/* FINANCIALS */}
        <GemCard contentSx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 950 }}>Financials</Typography>

          <Box sx={{ mt: 1.5 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Pay Period</TableCell>
                    <TableCell>Hours Worked</TableCell>
                    <TableCell>Hourly Rate</TableCell>
                    <TableCell>Bonus</TableCell>
                    <TableCell>Amount Paid</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {financials.map((f) => (
                    <TableRow key={f.id} sx={{ "& td": { borderBottom: "1px solid", borderColor: "divider" } }}>
                      <TableCell>{fmtDate(f.date)}</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>{f.payPeriod}</TableCell>
                      <TableCell>{f.hoursWorked}</TableCell>
                      <TableCell>{fmtMoney(f.hourlyRate)}</TableCell>
                      <TableCell>{fmtMoney(f.bonus)}</TableCell>
                      <TableCell sx={{ fontWeight: 950 }}>{fmtMoney(f.amountPaid)}</TableCell>
                      <TableCell align="right">
                        <RowActionsMenu
                          items={[
                            {
                              label: "View details",
                              onClick: () => alert(JSON.stringify(f, null, 2)),
                            },
                            {
                              label: "Print",
                              onClick: () => printOrPdf("Financials Row", JSON.stringify(f, null, 2)),
                            },
                            {
                              label: "Download PDF",
                              onClick: () => printOrPdf("Financials (PDF)", JSON.stringify(f, null, 2)),
                            },
                            {
                              label: "Send email (later)",
                              onClick: () => alert("Email sending will be implemented later."),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}

                  {financials.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}>
                          <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                            No financial records yet.
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </GemCard>
      </Box>

      {/* ADD EVENT DIALOG */}
      <GemDialog open={openAddEvent} onClose={() => setOpenAddEvent(false)} fullWidth maxWidth="sm">
        <Box sx={{ p: 2.2 }}>
          <Typography sx={{ fontWeight: 950, fontSize: 16 }}>Add Event</Typography>
        </Box>
        <Divider />
        <Box sx={{ p: 2.2, display: "grid", gap: 2 }}>
          <TextField
            label="Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={eventForm.date}
            onChange={(e) => setEventForm((s) => ({ ...s, date: e.target.value }))}
          />
          <TextField
            label="Title"
            size="small"
            value={eventForm.title}
            onChange={(e) => setEventForm((s) => ({ ...s, title: e.target.value }))}
          />
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <TextField
              label="Start"
              type="time"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={eventForm.start}
              onChange={(e) => setEventForm((s) => ({ ...s, start: e.target.value }))}
            />
            <TextField
              label="End"
              type="time"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={eventForm.end}
              onChange={(e) => setEventForm((s) => ({ ...s, end: e.target.value }))}
            />
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button onClick={() => setOpenAddEvent(false)} sx={{ fontWeight: 900 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              sx={{ fontWeight: 950 }}
              onClick={() => {
                const entry = {
                  id: createId("ev"),
                  date: eventForm.date || todayISO(),
                  title: (eventForm.title || "Event").trim(),
                  start: eventForm.start || "08:00",
                  end: eventForm.end || "09:00",
                };
                const next = [entry, ...(events || [])];
                setEvents(next);
                setJSON(STAFF_EVENTS_KEY(staff.id), next);
                setSelectedDayISO(entry.date);
                setOpenAddEvent(false);
              }}
            >
              Save
            </Button>
          </Box>
        </Box>
      </GemDialog>

      {/* ADD PUNCH DIALOG */}
      <GemDialog open={openAddPunch} onClose={() => setOpenAddPunch(false)} fullWidth maxWidth="sm">
        <Box sx={{ p: 2.2 }}>
          <Typography sx={{ fontWeight: 950, fontSize: 16 }}>Add Punch</Typography>
        </Box>
        <Divider />
        <Box sx={{ p: 2.2, display: "grid", gap: 2 }}>
          <TextField
            label="Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={punchForm.date}
            onChange={(e) => setPunchForm((s) => ({ ...s, date: e.target.value }))}
          />

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <TextField
              label="Punch In"
              type="time"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={punchForm.in}
              onChange={(e) => setPunchForm((s) => ({ ...s, in: e.target.value }))}
            />
            <TextField
              label="Punch Out"
              type="time"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={punchForm.out}
              onChange={(e) => setPunchForm((s) => ({ ...s, out: e.target.value }))}
            />
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button onClick={() => setOpenAddPunch(false)} sx={{ fontWeight: 900 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              sx={{ fontWeight: 950 }}
              onClick={() => {
                const maxNo = Math.max(0, ...(attendance.map((a) => Number(a.no || 0))));
                const mins = minutesBetween(punchForm.in, punchForm.out);
                const h = hoursFloat(mins);

                const entry = {
                  id: createId("p"),
                  no: maxNo + 1,
                  date: punchForm.date || todayISO(),
                  in: punchForm.in || nowTimeHHMM(),
                  out: punchForm.out || nowTimeHHMM(),
                  hours: h,
                };

                const next = [entry, ...(attendance || [])];
                setAttendance(next);
                setJSON(STAFF_ATTENDANCE_KEY(staff.id), next);
                setOpenAddPunch(false);
              }}
            >
              Save
            </Button>
          </Box>
        </Box>
      </GemDialog>
    </Box>
  );
}

/** ------- UI helpers ------- */
function InfoRow({ label, value, valueSx, rightIcon, onRightIconClick }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
        {label}:
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 900, ...valueSx }}>
          {value}
        </Typography>

        {rightIcon ? (
          <Typography
            variant="body2"
            sx={{ cursor: "pointer", userSelect: "none" }}
            onClick={onRightIconClick}
            title="Action"
          >
            {rightIcon}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
