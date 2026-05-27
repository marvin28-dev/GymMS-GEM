import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isDemoMode } from "../utils/auth";

import {
  Avatar,
  Box,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  CircularProgress,
  alpha,
  useTheme,
} from "@mui/material";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import KeyboardReturnRoundedIcon from "@mui/icons-material/KeyboardReturnRounded";
import BackspaceRoundedIcon from "@mui/icons-material/BackspaceRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import TodayRoundedIcon from "@mui/icons-material/TodayRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import QrCodeScannerRoundedIcon from "@mui/icons-material/QrCodeScannerRounded";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import AddTaskRoundedIcon from "@mui/icons-material/AddTaskRounded";
import AssessmentRoundedIcon from "@mui/icons-material/AssessmentRounded";

import GemCard from "../components/ui/GemCard";
import GemTextField from "../components/ui/GemTextField";
import AddMemberVisitorPage from "../components/members/AddMemberVisitorPage";
import { getAll as getMembers } from '../services/members.service';

/* ----------------------------- LocalStorage helpers ----------------------------- */
const MEMBERS_LS_KEY = "gem_members_v1";
const STAFF_LS_KEY = "gem_staff_v1";
const FRONTDESK_CHECKINS_LS_KEY = "gem_frontdesk_checkins_v1";
const FRONTDESK_SESSION_LS_KEY = "gem_frontdesk_session_v1";
const FRONTDESK_PROGRAMS_LS_KEY = "gem_frontdesk_programs_v1";
const FRONTDESK_PRODUCTS_LS_KEY = "gem_frontdesk_products_v1";
const FRONTDESK_SALES_LS_KEY = "gem_frontdesk_sales_v1";
const FRONTDESK_TASKS_LS_KEY = "gem_frontdesk_tasks_v1";
const FRONTDESK_REPORTS_LS_KEY = "gem_frontdesk_reports_v1";

const DETAILS_KEY = (id) => `gem_member_details_v1_${id}`;
const MEMBERSHIP_KEY = (id) => `gem_member_membership_v1_${id}`;

const OWING_FIELDS = ["balance", "amountOwing", "owing", "dueAmount", "arrears"];
const DEFAULT_FRONTDESK_PIN = "1234";

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
  return (a + b).toUpperCase() || "??";
}
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function isoDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function formatMoney(v) {
  const n = Number(v || 0);
  return n.toLocaleString();
}

/* ----------------------------- Schedule parsing ----------------------------- */
const DAY_ALIASES = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};
function parseScheduleDays(scheduleStr = "") {
  const raw = String(scheduleStr || "")
    .toLowerCase()
    .replace(/\./g, "")
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const days = new Set();
  raw.forEach((token) => {
    const k = token.replace(/\s+/g, "");
    if (DAY_ALIASES[k] !== undefined) days.add(DAY_ALIASES[k]);
  });
  return days;
}

/* ----------------------------- Seeds ----------------------------- */
function seedProgramsIfEmpty() {
  const existing = getJSON(FRONTDESK_PROGRAMS_LS_KEY, null);
  if (existing?.length) return existing;

  const today = new Date();
  const mk = (offsetDays, title, start, end) => ({
    id: createId("pg"),
    dateISO: isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays)),
    title,
    start,
    end,
  });

  const seeded = [
    mk(0, "Morning HIIT", "07:00", "08:00"),
    mk(0, "Evening Strength", "18:00", "19:30"),
    mk(1, "Zumba Session", "17:30", "18:30"),
    mk(2, "Boxing Basics", "19:00", "20:00"),
    mk(3, "Yoga Flow", "06:30", "07:30"),
    mk(4, "Leg Day Group", "18:00", "19:00"),
    mk(5, "Mobility & Stretch", "08:00", "09:00"),
  ];

  setJSON(FRONTDESK_PROGRAMS_LS_KEY, seeded);
  return seeded;
}

function seedProductsIfEmpty() {
  const existing = getJSON(FRONTDESK_PRODUCTS_LS_KEY, null);
  if (existing?.length) return existing;

  const seeded = [
    { id: createId("prd"), name: "Whey Protein", price: 25000, stock: 12 },
    { id: createId("prd"), name: "Creatine", price: 12000, stock: 18 },
    { id: createId("prd"), name: "Gym Gloves", price: 8000, stock: 10 },
    { id: createId("prd"), name: "Shaker Bottle", price: 5000, stock: 20 },
    { id: createId("prd"), name: "Resistance Band", price: 7000, stock: 14 },
  ];

  setJSON(FRONTDESK_PRODUCTS_LS_KEY, seeded);
  return seeded;
}

/* ----------------------------- Shared shell ----------------------------- */
function SectionShell({ title, children, right }) {
  return (
    <Box
      sx={{
        height: "100%",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 5,
        bgcolor: "background.paper",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
        px: { xs: 2, md: 2.5 },
        pt: { xs: 2, md: 2.25 },
        pb: { xs: 2, md: 2.1 },
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.25, mb: 1.8 }}>
        <Typography
          sx={{
            fontWeight: 950,
            fontSize: 17,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
            pl: 0.15,
          }}
        >
          {title}
        </Typography>
        {right}
      </Box>
      {children}
    </Box>
  );
}

/* ----------------------------- Month Calendar ----------------------------- */
function MonthCalendar({ value, onPickDate, sx }) {
  const theme = useTheme();
  const monthStart = new Date(value.getFullYear(), value.getMonth(), 1);
  const monthEnd = new Date(value.getFullYear(), value.getMonth() + 1, 0);

  const startWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const monthLabel = value.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = new Date();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(value.getFullYear(), value.getMonth(), day));
  while (cells.length % 7 !== 0) cells.push(null);

  const isSameDay = (a, b) =>
    a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const CELL_H = { xs: 42, md: 46, lg: 48 };

  return (
    <Box sx={{ display: "grid", gap: 1.25, ...sx }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 950, letterSpacing: 0.2 }}>
          {monthLabel}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          <Tooltip title="Previous month">
            <IconButton size="small" onClick={() => onPickDate(new Date(value.getFullYear(), value.getMonth() - 1, 1), true)}>
              <ArrowBackRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Today">
            <IconButton size="small" onClick={() => onPickDate(new Date(), true)}>
              <TodayRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Next month">
            <IconButton size="small" onClick={() => onPickDate(new Date(value.getFullYear(), value.getMonth() + 1, 1), true)}>
              <ArrowForwardRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.75, alignItems: "center" }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
          <Typography key={d} sx={{ fontWeight: 900, fontSize: 12, textAlign: "center", color: "text.secondary" }}>
            {d}
          </Typography>
        ))}

        {cells.map((date, idx) => {
          const selected = isSameDay(date, value);
          const isToday = isSameDay(date, today);

          return (
            <Box
              key={idx}
              onClick={() => date && onPickDate(date, false)}
              sx={{
                height: CELL_H,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                cursor: date ? "pointer" : "default",
                border: "1px solid",
                borderColor: selected ? alpha(theme.palette.primary.main, 0.55) : "divider",
                bgcolor: selected ? alpha(theme.palette.primary.main, 0.1) : "transparent",
                opacity: date ? 1 : 0,
                userSelect: "none",
                position: "relative",
                transition: "120ms ease",
                "&:hover": date
                  ? { bgcolor: selected ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.text.primary, 0.03) }
                  : undefined,
              }}
            >
              <Typography sx={{ fontWeight: 950, fontSize: 13 }}>{date ? date.getDate() : ""}</Typography>

              {isToday && date && !selected && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 6,
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    bgcolor: "primary.main",
                    opacity: 0.8,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/* ----------------------------- PIN Login panel ----------------------------- */
function PinLogin({ onSuccess }) {
  const theme = useTheme();
  const [pin, setPin] = useState("");
  const [snack, setSnack] = useState("");

  const press = (v) => {
    if (v === "back") return setPin((p) => p.slice(0, -1));
    if (v === "enter") {
      if (pin === DEFAULT_FRONTDESK_PIN) {
        const session = { at: Date.now(), method: "pin" };
        setJSON(FRONTDESK_SESSION_LS_KEY, session);
        onSuccess?.(session);
        return;
      }
      setSnack("Wrong PIN. Try again.");
      setPin("");
      return;
    }
    setPin((p) => (p.length >= 6 ? p : p + v));
  };

  const dot = (filled) => (
    <Box
      sx={{
        width: 10,
        height: 10,
        borderRadius: 99,
        bgcolor: filled ? "primary.main" : alpha(theme.palette.text.primary, 0.15),
      }}
    />
  );

  return (
    <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", p: 2, bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
      <Box sx={{ width: "100%", maxWidth: 520 }}>
        <GemCard contentSx={{ p: 2.25 }}>
          <Stack spacing={1.25} alignItems="center">
            <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>
              <LockRoundedIcon />
            </Avatar>

            <Typography sx={{ fontWeight: 950, fontSize: 22 }}>Front Desk Login</Typography>
            <Typography sx={{ fontWeight: 800 }} color="text.secondary">
              Enter the Front Desk PIN to continue
            </Typography>

            <Box sx={{ mt: 1, width: "100%", border: "1px solid", borderColor: "divider", borderRadius: 3, p: 1.5, display: "flex", justifyContent: "center", gap: 1.25 }}>
              {dot(pin.length >= 1)}
              {dot(pin.length >= 2)}
              {dot(pin.length >= 3)}
              {dot(pin.length >= 4)}
              {dot(pin.length >= 5)}
              {dot(pin.length >= 6)}
            </Box>

            <Divider sx={{ width: "100%", my: 1 }} />

            <Box sx={{ width: "100%", display: "grid", gap: 1.25, gridTemplateColumns: "repeat(3, 1fr)" }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <Button key={n} variant="outlined" onClick={() => press(String(n))} sx={{ fontWeight: 950, py: 1.6, borderRadius: 3 }}>
                  {n}
                </Button>
              ))}

              <Button variant="outlined" onClick={() => press("back")} sx={{ fontWeight: 950, py: 1.6, borderRadius: 3 }} startIcon={<BackspaceRoundedIcon />}>
                Back
              </Button>

              <Button variant="outlined" onClick={() => press("0")} sx={{ fontWeight: 950, py: 1.6, borderRadius: 3 }}>
                0
              </Button>

              <Button variant="contained" onClick={() => press("enter")} sx={{ fontWeight: 950, py: 1.6, borderRadius: 3 }} startIcon={<KeyboardReturnRoundedIcon />}>
                Enter
              </Button>
            </Box>

            {isDemoMode() ? (
              <Box sx={{ mt: 1, width: '100%', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 3, p: 1.5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#c9a96e', textTransform: 'uppercase', letterSpacing: '1px', mb: 0.5 }}>
                  Demo — Front Desk PIN
                </Typography>
                <Typography sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 800, color: '#c9a96e', letterSpacing: '8px' }}>
                  {DEFAULT_FRONTDESK_PIN}
                </Typography>
              </Box>
            ) : (
              <Typography sx={{ mt: 1, fontWeight: 800, fontSize: 12 }} color="text.secondary">
                Default PIN (for now): <b>{DEFAULT_FRONTDESK_PIN}</b>
              </Typography>
            )}
          </Stack>
        </GemCard>
      </Box>

      <Snackbar open={Boolean(snack)} autoHideDuration={2200} onClose={() => setSnack("")} message={snack} />
    </Box>
  );
}

/* ----------------------------- QR Scanner Dialog ----------------------------- */
function QrScannerDialog({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const stop = () => {
    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } catch {}
    rafRef.current = null;

    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;

    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {}
    }
    setBusy(false);
  };

  const start = async () => {
    setErr("");
    setBusy(true);

    const BarcodeDetectorClass = window.BarcodeDetector;
    if (!BarcodeDetectorClass) {
      setErr("QR scanning is not supported in this browser. Use Chrome/Edge.");
      setBusy(false);
      return;
    }

    try {
      const detector = new BarcodeDetectorClass({ formats: ["qr_code"] });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const tick = async () => {
        try {
          if (!videoRef.current) return;
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0]?.rawValue || "";
            if (raw) {
              stop();
              onDetected?.(raw);
              onClose?.();
              return;
            }
          }
        } catch {}
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setErr("Could not access camera. Check permissions and try again.");
      setBusy(false);
    }
  };

  useEffect(() => {
    if (open) start();
    else stop();
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 950 }}>Scan QR Code</DialogTitle>
      <DialogContent sx={{ pt: 1.5 }}>
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden", bgcolor: alpha("#0F172A", 0.03) }}>
          <Box sx={{ position: "relative", width: "100%", aspectRatio: "16/10" }}>
            <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {busy && (
              <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
                <Box sx={{ borderRadius: 3, px: 2, py: 1.1, bgcolor: "rgba(0,0,0,0.55)", color: "white", display: "flex", alignItems: "center", gap: 1, fontWeight: 900 }}>
                  <CircularProgress size={18} sx={{ color: "white" }} />
                  Scanning…
                </Box>
              </Box>
            )}
          </Box>
        </Box>

        {err ? (
          <Typography sx={{ mt: 1.2, fontWeight: 900 }} color="error">
            {err}
          </Typography>
        ) : (
          <Typography sx={{ mt: 1.2, fontWeight: 800 }} color="text.secondary">
            Point the camera at the QR code. It will auto-detect.
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={() => {
            stop();
            onClose?.();
          }}
          sx={{ fontWeight: 900 }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ----------------------------- Day details dialog ----------------------------- */
function DayDetailsDialog({ open, onClose, date, staffWorking, programs, onOpenProfile }) {
  const label = date ? date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 950 }}>Day details</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Chip
          label={label}
          sx={{
            fontWeight: 900,
            mb: 1.5,
            bgcolor: "rgba(67,56,202,0.10)",
            border: "1px solid",
            borderColor: "rgba(67,56,202,0.20)",
          }}
        />

        <Box sx={{ display: "grid", gap: 1.25 }}>
          <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 1.25 }}>
            <Typography sx={{ fontWeight: 950, fontSize: 13, mb: 0.8 }}>Staff working</Typography>
            <Box sx={{ display: "grid", gap: 0.8 }}>
              {(staffWorking || []).slice(0, 14).map((s) => (
                <Box
                  key={s.id}
                  onClick={() => onOpenProfile?.("staff", s.id)}
                  sx={{
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 3,
                    p: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    "&:hover": { bgcolor: alpha("#0F172A", 0.03) },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Avatar sx={{ width: 28, height: 28, fontWeight: 950, bgcolor: alpha("#4338CA", 0.12), color: "primary.main" }}>
                      {initialsFromName(s.name)}
                    </Avatar>
                    <Box>
                      <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{s.name}</Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                        {s.role || "Staff"} • {s.schedule || "-"}
                      </Typography>
                    </Box>
                  </Box>
                  <OpenInNewRoundedIcon fontSize="small" sx={{ opacity: 0.7 }} />
                </Box>
              ))}

              {(staffWorking || []).length === 0 && (
                <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                  No staff scheduled for this day.
                </Typography>
              )}
            </Box>
          </Box>

          <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 1.25 }}>
            <Typography sx={{ fontWeight: 950, fontSize: 13, mb: 0.8 }}>Gym program</Typography>
            <Box sx={{ display: "grid", gap: 0.8 }}>
              {(programs || []).map((p) => (
                <Box key={p.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 1, bgcolor: alpha("#0F172A", 0.02) }}>
                  <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{p.title}</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                    {p.start} - {p.end}
                  </Typography>
                </Box>
              ))}

              {(programs || []).length === 0 && (
                <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                  No program scheduled for this day.
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ fontWeight: 900 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ----------------------------- Operation dialogs ----------------------------- */
function AddTaskDialog({ open, onClose, onSave, staff }) {
  const [assignTo, setAssignTo] = useState("myself");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setAssignTo("myself");
      setTitle("");
      setNotes("");
    }
  }, [open]);

  const submit = () => {
    if (!title.trim()) return;
    onSave?.({
      id: createId("task"),
      assignTo,
      title: title.trim(),
      notes: notes.trim(),
      createdAt: Date.now(),
      status: "open",
    });
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 950 }}>Add a Task</DialogTitle>
      <DialogContent sx={{ pt: 1.5 }}>
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 12.5, mb: 0.75 }} color="text.secondary">
              Name
            </Typography>
            <FormControl fullWidth size="small">
              <Select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} sx={{ fontWeight: 900 }}>
                <MenuItem value="myself">Assign To</MenuItem>
                {(staff || []).map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name || "Staff"}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 12.5, mb: 0.75 }} color="text.secondary">
              Title
            </Typography>
            <GemTextField value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 12.5, mb: 0.75 }} color="text.secondary">
              Notes
            </Typography>
            <GemTextField value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={4} fullWidth />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ fontWeight: 900 }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} sx={{ fontWeight: 950 }}>
          Add a Task
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EodReportDialog({ open, onClose, onGenerate }) {
  const [name, setName] = useState("");
  const [types, setTypes] = useState({
    memberships: false,
    product: false,
    checkin: false,
    all: true,
  });

  useEffect(() => {
    if (!open) {
      setName("");
      setTypes({
        memberships: false,
        product: false,
        checkin: false,
        all: true,
      });
    }
  }, [open]);

  const toggle = (key) => {
    if (key === "all") {
      setTypes({ memberships: false, product: false, checkin: false, all: true });
      return;
    }
    setTypes((prev) => ({
      ...prev,
      all: false,
      [key]: !prev[key],
    }));
  };

  const submit = () => {
    const selected = types.all
      ? ["all"]
      : Object.entries(types)
          .filter(([k, v]) => k !== "all" && v)
          .map(([k]) => k);

    if (!name.trim()) return;

    onGenerate?.({
      id: createId("report"),
      name: name.trim(),
      types: selected.length ? selected : ["all"],
      createdAt: Date.now(),
    });
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 950 }}>Generate EOD Report</DialogTitle>
      <DialogContent sx={{ pt: 1.5 }}>
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 12.5, mb: 0.75 }} color="text.secondary">
              Name
            </Typography>
            <GemTextField value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 12.5, mb: 0.5 }} color="text.secondary">
              Type of Report
            </Typography>
            <Box sx={{ display: "grid", gap: 0.25 }}>
              <FormControlLabel control={<Checkbox checked={types.memberships} onChange={() => toggle("memberships")} />} label="MEMBERSHIPS" />
              <FormControlLabel control={<Checkbox checked={types.product} onChange={() => toggle("product")} />} label="PRODUCT" />
              <FormControlLabel control={<Checkbox checked={types.checkin} onChange={() => toggle("checkin")} />} label="CHECKIN" />
              <FormControlLabel control={<Checkbox checked={types.all} onChange={() => toggle("all")} />} label="ALL" />
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ fontWeight: 900 }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} sx={{ fontWeight: 950 }}>
          Generate Report
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ----------------------------- Main Component ----------------------------- */
export default function FrontDeskMode() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [session, setSession] = useState(() => getJSON(FRONTDESK_SESSION_LS_KEY, null));
  const [tab, setTab] = useState(0);

  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [dayDialogDate, setDayDialogDate] = useState(() => new Date());

  const [snack, setSnack] = useState("");

  const [members, setMembers] = useState(() => getJSON(MEMBERS_LS_KEY, []));

  useEffect(() => {
    getMembers()
      .then(res => {
        const apiMembers = res.data || [];
        const stored = getJSON(MEMBERS_LS_KEY, []);
        const apiIds = new Set(apiMembers.map(m => m.id));
        const localOnly = stored.filter(m => !apiIds.has(m.id));
        const merged = [...apiMembers, ...localOnly];
        setJSON(MEMBERS_LS_KEY, merged);
        setMembers(merged);
      })
      .catch(() => {});
  }, []);
  const [staff, setStaff] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [frontDeskTasks, setFrontDeskTasks] = useState([]);
  const [generatedReports, setGeneratedReports] = useState([]);

  const [query, setQuery] = useState("");
  const [qrOpen, setQrOpen] = useState(false);

  const [checkins, setCheckins] = useState(() => getJSON(FRONTDESK_CHECKINS_LS_KEY, []));
  const [recentScope, setRecentScope] = useState("today");

  const [productQuery, setProductQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [saleQty, setSaleQty] = useState(1);

  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [eodOpen, setEodOpen] = useState(false);

  useEffect(() => {
    setStaff(getJSON(STAFF_LS_KEY, []));
    setPrograms(seedProgramsIfEmpty());
    setProducts(seedProductsIfEmpty());
    setSales(getJSON(FRONTDESK_SALES_LS_KEY, []));
    setFrontDeskTasks(getJSON(FRONTDESK_TASKS_LS_KEY, []));
    setGeneratedReports(getJSON(FRONTDESK_REPORTS_LS_KEY, []));
  }, []);

  const isMemberOwing = (memberRaw) => {
    if (!memberRaw) return false;
    if (String(memberRaw.status || "").toLowerCase() === "unpaid") return true;
    if (memberRaw.isOwing === true) return true;

    for (const k of OWING_FIELDS) {
      const v = memberRaw[k];
      if (typeof v === "number" && v > 0) return true;
      if (typeof v === "string" && v.trim() !== "" && Number(v) > 0) return true;
    }
    return false;
  };

  const options = useMemo(() => {
    const m = (members || []).map((x) => {
      const name = x.fullName || x.name || `${x.firstName || ""} ${x.lastName || ""}`.trim() || "Member";
      return { id: x.id, name, type: "member", owing: isMemberOwing(x), raw: x };
    });

    const s = (staff || []).map((x) => ({
      id: x.id,
      name: x.name || "Staff",
      type: "staff",
      owing: false,
      raw: x,
    }));

    return [...m, ...s].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [members, staff]);

  const filteredRecent = useMemo(() => {
    const rows = [...(checkins || [])].sort((a, b) => b.at - a.at);
    if (recentScope === "all") return rows;
    const cutoff = startOfDay(new Date());
    return rows.filter((r) => new Date(r.at) >= cutoff);
  }, [checkins, recentScope]);

  const recentMembers = useMemo(() => filteredRecent.filter((r) => r.personType === "member"), [filteredRecent]);
  const recentStaff = useMemo(() => filteredRecent.filter((r) => r.personType === "staff"), [filteredRecent]);

  const saveCheckins = (rows) => {
    setCheckins(rows);
    setJSON(FRONTDESK_CHECKINS_LS_KEY, rows);
  };

  const doCheckin = (person) => {
    if (!person) return;

    const row = {
      id: createId("ci"),
      at: Date.now(),
      dayISO: new Date().toISOString().slice(0, 10),
      personId: person.id,
      personName: person.name,
      personType: person.type,
    };

    const next = [row, ...(checkins || [])].slice(0, 120);
    saveCheckins(next);

    setSnack(`${person.name} checked in (${person.type}) ✅`);
    setQuery("");
  };

  const tryMatchByCode = (code) => {
    const q = String(code || "").trim();
    if (!q) return null;

    const match = options.find((o) => {
      const raw = o.raw || {};
      const contact = String(raw.phone || raw.contact || "");
      const id = String(o.id || "");
      return raw.accessCode === q || contact.endsWith(q) || id.slice(-4) === q;
    });

    return match || null;
  };

  const pressKeypad = (v) => {
    if (v === "back") return setQuery((p) => p.slice(0, -1));
    if (v === "enter") {
      const typed = String(query || "").trim();
      const digits = typed && /^[0-9]+$/.test(typed);

      if (digits) {
        const m = tryMatchByCode(typed);
        if (!m) return setSnack("No match found for that code.");
        return doCheckin(m);
      }

      const matches = options.filter((o) => String(o.name).toLowerCase().includes(typed.toLowerCase()));
      if (matches.length === 1) return doCheckin(matches[0]);

      setSnack("Select a name from the list, or enter a valid code.");
      return;
    }

    setQuery((p) => {
      const next = (p || "") + v;
      return next.length > 24 ? next.slice(0, 24) : next;
    });
  };

  const handleQrDetected = (raw) => {
    const text = String(raw || "").trim();
    if (!text) return;

    const direct = options.find((o) => String(o.id) === text);
    if (direct) return doCheckin(direct);

    const digitsOnly = text.replace(/\D/g, "");
    const candidate = tryMatchByCode(digitsOnly || text);
    if (candidate) return doCheckin(candidate);

    setQuery(text);
    setSnack("QR scanned. Please select the person (if needed).");
  };

  const openProfile = (type, id) => {
    if (type === "member") navigate(`/members/${id}`);
    else if (type === "staff") navigate(`/staff/${id}`);
  };

  const logoutFrontDesk = () => {
    localStorage.removeItem(FRONTDESK_SESSION_LS_KEY);
    setSession(null);
  };

  const handleSignupSave = (payload) => {
    const id = `mem_${Date.now()}`;
    const isVisitor = payload?.personType === "visitor";

    const newMemberRow = {
      id,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      dateJoined: new Date().toISOString().slice(0, 10),
      lastVisit: new Date().toISOString().slice(0, 10),
      amountOwing: isVisitor ? 0 : Number(payload?.membership?.amountOwing || payload?.membership?.cost || 0),
      expiry: "",
    };

    const current = getJSON(MEMBERS_LS_KEY, []);
    const next = [newMemberRow, ...(current || [])];
    setJSON(MEMBERS_LS_KEY, next);
    setMembers(next);

    setJSON(DETAILS_KEY(id), {
      phone: payload.phone || "",
      email: payload?.details?.email || "",
      address: payload?.details?.address ? payload.details.address : payload?.details?.address || "",
      emergencyContact: payload?.details?.emergencyContact?.phone || "",
      checkingCode: "12**",
      status: "Active Membership",
      profileExpiry: "",
      owing: newMemberRow.amountOwing,
      raw: payload?.details || {},
    });

    if (payload?.membership) {
      setJSON(MEMBERSHIP_KEY(id), {
        plan: payload.membership.option || "Elite Plus",
        cost: Number(payload.membership.price || payload.membership.cost || 0),
        amountPaid: 0,
        amountOwing: Number(payload.membership.price || payload.membership.cost || 0),
        startDate: new Date().toISOString().slice(0, 10),
        endDate: "",
        sessionQty: payload.membership.sessionQty ?? null,
      });
    }

    setSnack(`${newMemberRow.firstName} ${newMemberRow.lastName} created ✅`);
    setTab(0);
  };

  const qTrim = query.trim();
  const isPureDigits = qTrim && /^[0-9]+$/.test(qTrim);

  // Direct code match: shown as a card when exactly 4 digits typed
  const codeMatchOption = useMemo(() => {
    if (!isPureDigits || qTrim.length !== 4) return null;
    return options.find((o) => String((o.raw || {}).accessCode || "") === qTrim) || null;
  }, [options, qTrim, isPureDigits]);

  const searchMatches = useMemo(() => {
    if (!qTrim || isPureDigits) return [];
    const qq = qTrim.toLowerCase();
    return options.filter((o) => String(o.name).toLowerCase().includes(qq)).slice(0, 10);
  }, [options, qTrim, isPureDigits]);

  const dayISO = useMemo(() => isoDay(dayDialogDate), [dayDialogDate]);
  const weekday = useMemo(() => dayDialogDate.getDay(), [dayDialogDate]);

  const staffWorkingThatDay = useMemo(() => {
    const rows = (staff || []).map((s) => ({ ...s, _days: parseScheduleDays(s.schedule || "") }));
    return rows.filter((s) => s._days.has(weekday));
  }, [staff, weekday]);

  const programsForThatDay = useMemo(() => {
    return (programs || []).filter((p) => p.dateISO === dayISO);
  }, [programs, dayISO]);

  const productMatches = useMemo(() => {
    const q = String(productQuery || "").trim().toLowerCase();
    if (!q) return [];
    return (products || [])
      .filter((p) => String(p.name || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [productQuery, products]);

  const selectedProduct = useMemo(() => {
    return (products || []).find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const unitPrice = Number(selectedProduct?.price || 0);
  const totalPrice = Number(saleQty || 0) * unitPrice;

  const todaySales = useMemo(() => {
    const today = isoDay(new Date());
    return (sales || []).filter((s) => isoDay(new Date(s.at)) === today);
  }, [sales]);

  const todayRevenue = useMemo(() => todaySales.reduce((sum, s) => sum + Number(s.totalPrice || 0), 0), [todaySales]);

  const handlePickProduct = (product) => {
    setSelectedProductId(product.id);
    setProductQuery(product.name);
    setSaleQty(1);
  };

  const handleSellProduct = () => {
    if (!selectedProduct) {
      setSnack("Please select a product.");
      return;
    }

    if (!saleQty || Number(saleQty) < 1) {
      setSnack("Please choose a valid quantity.");
      return;
    }

    if (Number(selectedProduct.stock || 0) < Number(saleQty)) {
      setSnack("Not enough stock for this product.");
      return;
    }

    const saleRow = {
      id: createId("sale"),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      qty: Number(saleQty),
      unitPrice: Number(selectedProduct.price || 0),
      totalPrice: Number(totalPrice),
      at: Date.now(),
    };

    const nextSales = [saleRow, ...(sales || [])];
    setSales(nextSales);
    setJSON(FRONTDESK_SALES_LS_KEY, nextSales);

    const nextProducts = (products || []).map((p) =>
      p.id === selectedProduct.id
        ? { ...p, stock: Number(p.stock || 0) - Number(saleQty) }
        : p
    );
    setProducts(nextProducts);
    setJSON(FRONTDESK_PRODUCTS_LS_KEY, nextProducts);

    setSnack(`${selectedProduct.name} sold successfully ✅`);
    setProductQuery("");
    setSelectedProductId("");
    setSaleQty(1);
  };

  const handleSaveTask = (task) => {
    const next = [task, ...(frontDeskTasks || [])];
    setFrontDeskTasks(next);
    setJSON(FRONTDESK_TASKS_LS_KEY, next);
    setSnack("Task added successfully ✅");
  };

  const handleGenerateReport = (report) => {
    const next = [report, ...(generatedReports || [])];
    setGeneratedReports(next);
    setJSON(FRONTDESK_REPORTS_LS_KEY, next);
    setSnack("EOD report generated ✅");
  };

  if (!session) return <PinLogin onSuccess={(s) => setSession(s)} />;

  return (
    <Box
      sx={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: alpha(theme.palette.primary.main, 0.02),
        p: { xs: 1.25, md: 2 },
        gap: 2,
      }}
    >
      <GemCard contentSx={{ p: 1.6 }}>
        <Box sx={{ display: "flex", alignItems: { xs: "flex-start", md: "center" }, justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Avatar sx={{ bgcolor: "primary.main" }}>
              <FitnessCenterIcon />
            </Avatar>
            <Box>
              <Typography sx={{ fontWeight: 950, fontSize: 18, lineHeight: 1.1 }}>ELITE FITNESS CLUB</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                Shell Nsimeyong
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Chip
              label="FRONT DESK MODE"
              sx={{
                fontWeight: 950,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: theme.palette.primary.main,
                border: "1px solid",
                borderColor: alpha(theme.palette.primary.main, 0.25),
              }}
            />
            <Typography sx={{ fontWeight: 900, fontSize: 12 }} color="text.secondary">
              Logged in as: <span style={{ color: theme.palette.text.primary }}>Marvin Ekokobe</span>
            </Typography>

            <Button variant="outlined" startIcon={<LogoutRoundedIcon />} sx={{ fontWeight: 950, borderRadius: 3 }} onClick={logoutFrontDesk}>
              Exit Front Desk
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 1.35 }} />

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ "& .MuiTab-root": { fontWeight: 950, textTransform: "none" } }}>
          <Tab label="CHECKIN" />
          <Tab label="SIGNUP" />
          <Tab label="PRODUCT SALE" />
          <Tab label="OPERATIONS" />
        </Tabs>
      </GemCard>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        {tab === 0 && (
          <Box
            sx={{
              height: "100%",
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", lg: "1.05fr 1.4fr 1fr" },
              alignItems: "stretch",
            }}
          >
            <SectionShell title="Gym Calendar">
              <MonthCalendar
                value={calendarMonth}
                onPickDate={(date, isNav) => {
                  if (isNav) {
                    setCalendarMonth(date);
                    return;
                  }
                  setDayDialogDate(date);
                  setDayDialogOpen(true);
                }}
              />

              <Divider sx={{ my: 1.5 }} />

              <Typography sx={{ fontWeight: 800, fontSize: 13, lineHeight: 1.4, pl: 0.15 }} color="text.secondary">
                Click a day to open day details.
              </Typography>
              <Box sx={{ mt: "auto" }} />
            </SectionShell>

            <SectionShell title="Checkin Member or Staff" right={<Box sx={{ width: 24 }} />}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <GemTextField
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or enter code"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") pressKeypad("enter");
                  }}
                  InputProps={{
                    startAdornment: (
                      <Box sx={{ display: "flex", alignItems: "center", pr: 0.5 }}>
                        <SearchRoundedIcon fontSize="small" />
                      </Box>
                    ),
                    endAdornment: (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Tooltip title="Scan QR code">
                          <IconButton size="small" onClick={() => setQrOpen(true)}>
                            <QrCodeScannerRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Check in">
                          <IconButton
                            size="small"
                            onClick={() => pressKeypad("enter")}
                            sx={{
                              border: "1px solid",
                              borderColor: alpha(theme.palette.primary.main, 0.35),
                              bgcolor: alpha(theme.palette.primary.main, 0.08),
                            }}
                          >
                            <CheckRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ),
                  }}
                  sx={{ flex: 1 }}
                />
              </Box>

              {/* Code match card — shown when 4-digit access code found */}
              {codeMatchOption && (
                <Box
                  sx={{
                    mt: 1.5,
                    border: "2px solid",
                    borderColor: "primary.main",
                    borderRadius: 3,
                    p: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar
                      sx={{
                        width: 44,
                        height: 44,
                        fontWeight: 950,
                        fontSize: 16,
                        bgcolor: alpha(theme.palette.primary.main, 0.18),
                        color: theme.palette.primary.main,
                      }}
                    >
                      {initialsFromName(codeMatchOption.name)}
                    </Avatar>
                    <Box>
                      <Typography sx={{ fontWeight: 900, fontSize: 15, lineHeight: 1.2 }}>
                        {codeMatchOption.name}
                      </Typography>
                      <Typography sx={{ fontWeight: 700, fontSize: 12, mt: 0.3 }} color="text.secondary">
                        {String((codeMatchOption.raw || {}).id || "")} · {String((codeMatchOption.raw || {}).package || "Member")}
                      </Typography>
                      <Box sx={{ mt: 0.6 }}>
                        {codeMatchOption.owing ? (
                          <Chip
                            label={`Owes ${formatMoney((codeMatchOption.raw || {}).balance || 0)} FCFA`}
                            size="small"
                            sx={{ fontWeight: 900, fontSize: 11, bgcolor: alpha(theme.palette.error.main, 0.12), color: theme.palette.error.main }}
                          />
                        ) : (
                          <Chip
                            label="No balance due"
                            size="small"
                            sx={{ fontWeight: 900, fontSize: 11, bgcolor: alpha(theme.palette.success.main, 0.12), color: theme.palette.success.main }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{ fontWeight: 900, borderRadius: 2 }}
                      onClick={() => openProfile(codeMatchOption.type, codeMatchOption.id)}
                    >
                      Profile
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<CheckRoundedIcon />}
                      sx={{ fontWeight: 900, borderRadius: 2 }}
                      onClick={() => doCheckin(codeMatchOption)}
                    >
                      Check In
                    </Button>
                  </Box>
                </Box>
              )}

              {Boolean(qTrim) && !isPureDigits && (
                <Box
                  sx={{
                    mt: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 3,
                    overflow: "hidden",
                    maxHeight: 240,
                    overflowY: "auto",
                  }}
                >
                  {searchMatches.map((o) => {
                    const isOwing = o.type === "member" && o.owing;
                    return (
                      <Box
                        key={`${o.type}_${o.id}`}
                        onClick={() => openProfile(o.type, o.id)}
                        sx={{
                          px: 1.5,
                          py: 1.15,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                          "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.03) },
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              fontWeight: 950,
                              bgcolor: alpha(theme.palette.primary.main, 0.12),
                              color: theme.palette.primary.main,
                            }}
                          >
                            {initialsFromName(o.name)}
                          </Avatar>

                          <Box>
                            <Typography
                              sx={{
                                fontWeight: 900,
                                fontSize: 13,
                                color: isOwing ? theme.palette.error.main : "text.primary",
                              }}
                            >
                              {o.name}
                            </Typography>
                            <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                              {o.type === "member" ? "Member" : "Staff"}
                            </Typography>
                          </Box>
                        </Box>

                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            doCheckin(o);
                          }}
                          sx={{
                            border: "1px solid",
                            borderColor: alpha(theme.palette.primary.main, 0.25),
                            bgcolor: alpha(theme.palette.primary.main, 0.06),
                          }}
                        >
                          <CheckRoundedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Box>
              )}

              <Divider sx={{ my: 1.5 }} />

              <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: "repeat(3, 1fr)", mt: 0.25 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <Button key={n} variant="outlined" sx={{ fontWeight: 950, py: 2.05, borderRadius: 999 }} onClick={() => pressKeypad(String(n))}>
                    {n}
                  </Button>
                ))}

                <Button variant="outlined" sx={{ fontWeight: 950, py: 2.05, borderRadius: 999 }} startIcon={<BackspaceRoundedIcon />} onClick={() => pressKeypad("back")}>
                  Back
                </Button>

                <Button variant="outlined" sx={{ fontWeight: 950, py: 2.05, borderRadius: 999 }} onClick={() => pressKeypad("0")}>
                  0
                </Button>

                <Button variant="contained" sx={{ fontWeight: 950, py: 2.05, borderRadius: 999 }} startIcon={<KeyboardReturnRoundedIcon />} onClick={() => pressKeypad("enter")}>
                  Enter
                </Button>
              </Box>

              <Box sx={{ mt: "auto" }} />
            </SectionShell>

            <SectionShell
              title="Recent Checkin"
              right={
                <FormControl size="small" sx={{ width: 140 }}>
                  <Select value={recentScope} onChange={(e) => setRecentScope(e.target.value)} sx={{ fontWeight: 900 }}>
                    <MenuItem value="today">Today</MenuItem>
                    <MenuItem value="all">All</MenuItem>
                  </Select>
                </FormControl>
              }
            >
              <Divider />

              <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", mt: 1.5, display: "grid", gap: 1.5 }}>
                <Box>
                  <Typography sx={{ fontWeight: 950, fontSize: 13, mb: 1 }}>Member Checkin</Typography>
                  <Box sx={{ display: "grid", gap: 1 }}>
                    {recentMembers.length === 0 ? (
                      <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                        No member check-ins yet.
                      </Typography>
                    ) : (
                      recentMembers.slice(0, 80).map((r) => (
                        <Box
                          key={r.id}
                          onClick={() => openProfile("member", r.personId)}
                          sx={{
                            cursor: "pointer",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 3,
                            p: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1,
                            "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.03) },
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Avatar sx={{ width: 28, height: 28, fontWeight: 950, bgcolor: alpha(theme.palette.primary.main, 0.12), color: theme.palette.primary.main }}>
                              {initialsFromName(r.personName)}
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{r.personName}</Typography>
                              <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                                {fmtTime(r.at)}
                              </Typography>
                            </Box>
                          </Box>
                          <OpenInNewRoundedIcon fontSize="small" sx={{ opacity: 0.7 }} />
                        </Box>
                      ))
                    )}
                  </Box>
                </Box>

                <Divider />

                <Box>
                  <Typography sx={{ fontWeight: 950, fontSize: 13, mb: 1 }}>Staff Checkin</Typography>
                  <Box sx={{ display: "grid", gap: 1 }}>
                    {recentStaff.length === 0 ? (
                      <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                        No staff check-ins yet.
                      </Typography>
                    ) : (
                      recentStaff.slice(0, 80).map((r) => (
                        <Box
                          key={r.id}
                          onClick={() => openProfile("staff", r.personId)}
                          sx={{
                            cursor: "pointer",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 3,
                            p: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1,
                            "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.03) },
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Avatar sx={{ width: 28, height: 28, fontWeight: 950, bgcolor: alpha(theme.palette.primary.main, 0.12), color: theme.palette.primary.main }}>
                              {initialsFromName(r.personName)}
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{r.personName}</Typography>
                              <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                                {fmtTime(r.at)}
                              </Typography>
                            </Box>
                          </Box>
                          <OpenInNewRoundedIcon fontSize="small" sx={{ opacity: 0.7 }} />
                        </Box>
                      ))
                    )}
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.25 }}>
                <Button
                  variant="text"
                  sx={{ fontWeight: 950 }}
                  onClick={() => {
                    saveCheckins([]);
                    setSnack("Recent check-ins cleared.");
                  }}
                >
                  Clear recent
                </Button>
              </Box>
            </SectionShell>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ height: "100%", overflow: "auto", pr: 0.5 }}>
            <AddMemberVisitorPage onCancel={() => setTab(0)} onSave={(payload) => handleSignupSave(payload)} />
          </Box>
        )}

        {tab === 2 && (
          <Box sx={{ height: "100%" }}>
            <SectionShell title="Product Sale">
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "300px 1fr" }, gap: 2, flex: 1, minHeight: 0 }}>
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 4,
                    p: 1.5,
                    display: "grid",
                    gap: 1.25,
                    alignContent: "start",
                    bgcolor: alpha(theme.palette.primary.main, 0.02),
                  }}
                >
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                    <Box
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 3,
                        p: 1.2,
                        bgcolor: "background.paper",
                      }}
                    >
                      <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                        Today Revenue
                      </Typography>
                      <Typography sx={{ fontWeight: 950, fontSize: 18, mt: 0.35 }}>
                        {formatMoney(todayRevenue)} FCFA
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 3,
                        p: 1.2,
                        bgcolor: "background.paper",
                      }}
                    >
                      <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                        Items Sold
                      </Typography>
                      <Typography sx={{ fontWeight: 950, fontSize: 18, mt: 0.35 }}>
                        {todaySales.reduce((sum, s) => sum + Number(s.qty || 0), 0)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Inventory2RoundedIcon fontSize="small" />
                    <Typography sx={{ fontWeight: 950, fontSize: 14 }}>Recent Sales</Typography>
                  </Box>

                  <Box sx={{ display: "grid", gap: 1, maxHeight: 340, overflow: "auto" }}>
                    {sales.length === 0 ? (
                      <Typography sx={{ fontWeight: 800, fontSize: 13 }} color="text.secondary">
                        No product sales yet.
                      </Typography>
                    ) : (
                      sales.slice(0, 8).map((s) => (
                        <Box
                          key={s.id}
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 3,
                            p: 1.1,
                            bgcolor: "background.paper",
                          }}
                        >
                          <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{s.productName}</Typography>
                          <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                            Qty {s.qty} • {formatMoney(s.totalPrice)} FCFA
                          </Typography>
                          <Typography sx={{ fontWeight: 800, fontSize: 11, mt: 0.35 }} color="text.secondary">
                            {fmtTime(s.at)}
                          </Typography>
                        </Box>
                      ))
                    )}
                  </Box>
                </Box>

                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 4,
                    p: { xs: 1.5, md: 2 },
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 0,
                  }}
                >
                  <Box sx={{ width: "100%", maxWidth: 520, display: "grid", gap: 2 }}>
                    <Box sx={{ position: "relative" }}>
                      <GemTextField
                        value={productQuery}
                        onChange={(e) => {
                          setProductQuery(e.target.value);
                          setSelectedProductId("");
                        }}
                        placeholder="Search Product you want to sell"
                        InputProps={{
                          startAdornment: (
                            <Box sx={{ display: "flex", alignItems: "center", pr: 0.5 }}>
                              <SearchRoundedIcon fontSize="small" />
                            </Box>
                          ),
                        }}
                      />

                      {productQuery.trim() && !selectedProductId && productMatches.length > 0 && (
                        <Box
                          sx={{
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            left: 0,
                            right: 0,
                            zIndex: 5,
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 3,
                            bgcolor: "background.paper",
                            boxShadow: "0 16px 32px rgba(15,23,42,0.08)",
                            overflow: "hidden",
                          }}
                        >
                          {productMatches.map((p) => (
                            <Box
                              key={p.id}
                              onClick={() => handlePickProduct(p)}
                              sx={{
                                px: 1.5,
                                py: 1.2,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 1,
                                "&:hover": { bgcolor: alpha(theme.palette.text.primary, 0.03) },
                              }}
                            >
                              <Typography sx={{ fontWeight: 900, fontSize: 14 }}>{p.name}</Typography>
                              <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                                {formatMoney(p.price)} FCFA
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>

                    <FormControl fullWidth size="small">
                      <Select value={saleQty} onChange={(e) => setSaleQty(Number(e.target.value))} displayEmpty sx={{ fontWeight: 900 }}>
                        {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                          <MenuItem key={n} value={n}>
                            {n}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <GemTextField
                      value={selectedProduct ? `${formatMoney(unitPrice)} FCFA` : ""}
                      placeholder="Unit Price"
                      disabled
                    />

                    <GemTextField
                      value={selectedProduct ? `${formatMoney(totalPrice)} FCFA` : ""}
                      placeholder="Total Price"
                      disabled
                    />

                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleSellProduct}
                      sx={{
                        mt: 1,
                        fontWeight: 950,
                        py: 1.4,
                        borderRadius: 2.5,
                      }}
                    >
                      Sell Product
                    </Button>
                  </Box>
                </Box>
              </Box>
            </SectionShell>
          </Box>
        )}

        {tab === 3 && (
          <Box sx={{ height: "100%" }}>
            <SectionShell title="Operations">
              <Box
                sx={{
                  flex: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 4,
                  display: "grid",
                  placeItems: "center",
                  px: { xs: 2, md: 4 },
                }}
              >
                <Box sx={{ width: "100%", maxWidth: 760 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      gap: 2,
                      alignItems: "center",
                    }}
                  >
                    <Button
                      variant="outlined"
                      onClick={() => setAddTaskOpen(true)}
                      sx={{
                        py: 1.55,
                        borderRadius: 1.75,
                        fontWeight: 950,
                        fontSize: 15,
                      }}
                      startIcon={<AddTaskRoundedIcon />}
                    >
                      Add a Task
                    </Button>

                    <Button
                      variant="outlined"
                      onClick={() => setEodOpen(true)}
                      sx={{
                        py: 1.55,
                        borderRadius: 1.75,
                        fontWeight: 950,
                        fontSize: 15,
                      }}
                      startIcon={<AssessmentRoundedIcon />}
                    >
                      Generate EOD Report
                    </Button>
                  </Box>

                  {(frontDeskTasks.length > 0 || generatedReports.length > 0) && (
                    <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2 }}>
                      <Box
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 3,
                          p: 1.5,
                          minHeight: 140,
                        }}
                      >
                        <Typography sx={{ fontWeight: 950, fontSize: 14, mb: 1.1 }}>Latest Tasks</Typography>
                        <Box sx={{ display: "grid", gap: 0.8 }}>
                          {frontDeskTasks.slice(0, 3).map((task) => (
                            <Box
                              key={task.id}
                              sx={{
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 3,
                                p: 1,
                              }}
                            >
                              <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{task.title}</Typography>
                              <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                                {task.assignTo === "myself" ? "Assign To" : staff.find((s) => s.id === task.assignTo)?.name || "Staff"}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>

                      <Box
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 3,
                          p: 1.5,
                          minHeight: 140,
                        }}
                      >
                        <Typography sx={{ fontWeight: 950, fontSize: 14, mb: 1.1 }}>Generated Reports</Typography>
                        <Box sx={{ display: "grid", gap: 0.8 }}>
                          {generatedReports.slice(0, 3).map((report) => (
                            <Box
                              key={report.id}
                              sx={{
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 3,
                                p: 1,
                              }}
                            >
                              <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{report.name}</Typography>
                              <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                                {report.types.join(", ").toUpperCase()}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </SectionShell>
          </Box>
        )}
      </Box>

      <DayDetailsDialog
        open={dayDialogOpen}
        onClose={() => setDayDialogOpen(false)}
        date={dayDialogDate}
        staffWorking={staffWorkingThatDay}
        programs={programsForThatDay}
        onOpenProfile={(type, id) => openProfile(type, id)}
      />

      <QrScannerDialog open={qrOpen} onClose={() => setQrOpen(false)} onDetected={handleQrDetected} />

      <AddTaskDialog open={addTaskOpen} onClose={() => setAddTaskOpen(false)} onSave={handleSaveTask} staff={staff} />

      <EodReportDialog open={eodOpen} onClose={() => setEodOpen(false)} onGenerate={handleGenerateReport} />

      <Snackbar open={Boolean(snack)} autoHideDuration={2200} onClose={() => setSnack("")} message={snack} />
    </Box>
  );
}