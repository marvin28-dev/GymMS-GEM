import React, { useEffect, useMemo, useState } from "react";

import {
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  InputAdornment,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import { alpha, useTheme } from "@mui/material/styles";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import BackspaceRoundedIcon from "@mui/icons-material/BackspaceRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AddPerson from "./AddPerson";
import GemCard from "../components/ui/GemCard";
import GemTextField from "../components/ui/GemTextField";

const MEMBERS_LS_KEY = "gem_members_v1";
const STAFF_LS_KEY = "gem_staff_v1";
const CHECKINS_LS_KEY = "gem_frontdesk_checkins_v1";

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
function toISODate(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}
function fmtTime(dtISO) {
  try {
    const d = new Date(dtISO);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dtISO;
  }
}
function initialsFromName(name = "") {
  const parts = String(name).trim().split(" ").filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase() || "??";
}

function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addMonths(date, delta) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
}
function daysInMonth(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = d.getMonth();
  return new Date(y, m + 1, 0).getDate();
}
function monthLabel(date) {
  return new Date(date).toLocaleDateString(undefined, { month: "long", year: "numeric" }).toUpperCase();
}
function buildMonthMatrix(monthDate) {
  const d = startOfMonth(monthDate);
  const total = daysInMonth(d);
  const startDow = d.getDay(); // 0 Sun ... 6 Sat

  const cells = [];
  // leading blanks
  for (let i = 0; i < startDow; i += 1) cells.push(null);
  // days
  for (let day = 1; day <= total; day += 1) {
    const x = new Date(d);
    x.setDate(day);
    cells.push(x);
  }
  // trailing blanks to complete weeks (6 rows max)
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  // keep at least 5 rows for stable height
  while (weeks.length < 5) weeks.push(new Array(7).fill(null));
  return weeks;
}

function SmallPill({ children, sx }) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 999,
        px: 1.25,
        py: 0.5,
        fontWeight: 900,
        fontSize: 12,
        bgcolor: "background.paper",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function KeyButton({ label, onClick, variant = "outlined" }) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      sx={{
        borderRadius: 3,
        fontWeight: 950,
        height: 54,
        minWidth: 0,
      }}
      fullWidth
    >
      {label}
    </Button>
  );
}

function FrontDesk() {
  const theme = useTheme();

  const [tab, setTab] = useState(0);

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));

  const [members, setMembers] = useState([]);
  const [staff, setStaff] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null); // {kind, id, name, meta}
  const [pin, setPin] = useState("");

  const [checkins, setCheckins] = useState([]);

  useEffect(() => {
    const m = getJSON(MEMBERS_LS_KEY, []);
    const s = getJSON(STAFF_LS_KEY, []);

    // normalize names (your members structure may vary)
    const normalizedMembers = (m || []).map((x) => ({
      id: x.id,
      name:
        x.fullName ||
        x.name ||
        `${x.firstName || ""} ${x.lastName || ""}`.trim() ||
        "Member",
      meta: x,
    }));

    const normalizedStaff = (s || []).map((x) => ({
      id: x.id,
      name: x.name || "Staff",
      role: x.role || x.position || "",
      meta: x,
    }));

    setMembers(normalizedMembers);
    setStaff(normalizedStaff);

    const ci = getJSON(CHECKINS_LS_KEY, []);
    setCheckins(Array.isArray(ci) ? ci : []);
  }, []);

  const todayISO = toISODate(new Date());
  const weeks = useMemo(() => buildMonthMatrix(month), [month]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const ms = members
      .filter((x) => x.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((x) => ({ kind: "member", id: x.id, name: x.name, meta: x.meta }));

    const ss = staff
      .filter((x) => x.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((x) => ({ kind: "staff", id: x.id, name: x.name, role: x.role, meta: x.meta }));

    // interleave a bit
    return [...ms, ...ss].slice(0, 8);
  }, [search, members, staff]);

  const checkinsForDay = useMemo(() => {
    return (checkins || [])
      .filter((c) => c.dateISO === selectedDate)
      .sort((a, b) => String(b.atISO).localeCompare(String(a.atISO)));
  }, [checkins, selectedDate]);

  const onSelectPerson = (p) => {
    setSelectedPerson(p);
    setSearch("");
    setPin("");
  };

  const onPinDigit = (d) => {
    setPin((p) => (p.length >= 6 ? p : p + String(d)));
  };

  const onBackspace = () => setPin((p) => p.slice(0, -1));
  const onClear = () => setPin("");

  const submitCheckin = () => {
    if (!selectedPerson) return;

    const now = new Date();
    const record = {
      id: createId("ci"),
      dateISO: selectedDate,
      atISO: now.toISOString(),
      kind: selectedPerson.kind, // member | staff
      personId: selectedPerson.id,
      name: selectedPerson.name,
      pin: pin || "", // keep (or remove later if you don't want to store)
    };

    const next = [record, ...(checkins || [])];
    setCheckins(next);
    setJSON(CHECKINS_LS_KEY, next);

    // reset like front desk flow
    setPin("");
    setSelectedPerson(null);
    setSearch("");
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography sx={{ fontWeight: 950, fontSize: 24 }}>Front Desk</Typography>
          <Typography color="text.secondary" sx={{ fontWeight: 800 }}>
            Front Desk Mode — Logged in as: Marvin Ekokobe
          </Typography>
        </Box>

        <SmallPill sx={{ gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: theme.palette.primary.main,
              boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.12)}`,
            }}
          />
          Front Desk Mode
        </SmallPill>
      </Box>

      <GemCard contentSx={{ p: 2 }}>
        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ "& .MuiTab-root": { fontWeight: 950, textTransform: "none" } }}
        >
          <Tab label="CHECKIN" />
          <Tab label="SIGNUP" />
          <Tab label="PRODUCT SALE" />
          <Tab label="OPERATIONS" />
        </Tabs>

        <Divider sx={{ my: 1.5 }} />

        {/* CHECKIN */}
        {tab === 0 && (
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", lg: "1.05fr 1fr 1.05fr" },
              alignItems: "start",
            }}
          >
            {/* LEFT: Calendar */}
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ fontWeight: 950 }}>Gym Calendar</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 900, borderRadius: 999 }}
                  onClick={() => {
                    setMonth(startOfMonth(new Date()));
                    setSelectedDate(toISODate(new Date()));
                  }}
                >
                  Today
                </Button>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <IconButton size="small" onClick={() => setMonth((m) => addMonths(m, -1))}>
                  <ArrowBackIosNewRoundedIcon fontSize="small" />
                </IconButton>
                <Typography sx={{ fontWeight: 950, letterSpacing: 0.8 }}>{monthLabel(month)}</Typography>
                <IconButton size="small" onClick={() => setMonth((m) => addMonths(m, 1))}>
                  <ArrowForwardIosRoundedIcon fontSize="small" />
                </IconButton>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.75, mb: 0.75 }}>
                {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                  <Typography key={d} sx={{ fontWeight: 900, fontSize: 12, textAlign: "center" }} color="text.secondary">
                    {d}
                  </Typography>
                ))}
              </Box>

              <Box sx={{ display: "grid", gap: 0.75 }}>
                {weeks.map((week, wi) => (
                  <Box key={wi} sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.75 }}>
                    {week.map((cell, ci) => {
                      const iso = cell ? toISODate(cell) : null;
                      const isSelected = iso && iso === selectedDate;
                      const isToday = iso && iso === todayISO;

                      return (
                        <Box
                          key={ci}
                          onClick={() => iso && setSelectedDate(iso)}
                          sx={{
                            height: 38,
                            borderRadius: 2.2,
                            border: "1px solid",
                            borderColor: iso ? (isSelected ? alpha(theme.palette.primary.main, 0.5) : "divider") : "transparent",
                            bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: iso ? "pointer" : "default",
                            opacity: iso ? 1 : 0,
                            position: "relative",
                            userSelect: "none",
                          }}
                        >
                          {iso ? (
                            <>
                              <Typography sx={{ fontWeight: 900, fontSize: 13 }}>
                                {cell.getDate()}
                              </Typography>
                              {isToday ? (
                                <Box
                                  sx={{
                                    position: "absolute",
                                    bottom: 6,
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    bgcolor: theme.palette.primary.main,
                                  }}
                                />
                              ) : null}
                            </>
                          ) : null}
                        </Box>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>

            {/* MIDDLE: Checkin Member/Staff + keypad */}
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 1.5 }}>
              <Typography sx={{ fontWeight: 950, mb: 1 }}>Checkin Member or staff</Typography>

              <Box sx={{ position: "relative" }}>
                <GemTextField
                  placeholder="Search Any Name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

                {searchResults.length > 0 && (
                  <Box
                    sx={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      mt: 0.75,
                      zIndex: 10,
                      bgcolor: "background.paper",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 3,
                      overflow: "hidden",
                      boxShadow: `0 12px 30px ${alpha(theme.palette.common.black, 0.10)}`,
                    }}
                  >
                    {searchResults.map((r) => (
                      <Box
                        key={`${r.kind}_${r.id}`}
                        onClick={() => onSelectPerson(r)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 1.1,
                          cursor: "pointer",
                          "&:hover": { bgcolor: "rgba(15,23,42,0.04)" },
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontWeight: 950,
                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                            color: theme.palette.primary.main,
                            border: "1px solid",
                            borderColor: alpha(theme.palette.primary.main, 0.22),
                          }}
                        >
                          {initialsFromName(r.name)}
                        </Avatar>

                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 900 }} noWrap>
                            {r.name}
                          </Typography>
                          <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                            {r.kind === "member" ? "Member" : "Staff"}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              <Box sx={{ mt: 1.25 }}>
                {selectedPerson ? (
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 3,
                      p: 1.2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
                        {initialsFromName(selectedPerson.name)}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 950 }} noWrap>
                          {selectedPerson.name}
                        </Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                          {selectedPerson.kind === "member" ? "Member" : "Staff"}
                        </Typography>
                      </Box>
                    </Box>

                    <IconButton size="small" onClick={() => setSelectedPerson(null)}>
                      <CloseRoundedIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
                  <Typography sx={{ fontWeight: 800 }} color="text.secondary">
                    Select a member or staff from search.
                  </Typography>
                )}
              </Box>

              {/* PIN display */}
              <Box
                sx={{
                  mt: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 3,
                  p: 1.2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                }}
              >
                <Typography sx={{ fontWeight: 950 }}>
                  PIN:{" "}
                  <span style={{ letterSpacing: 6 }}>
                    {pin ? "•".repeat(pin.length) : "—"}
                  </span>
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <IconButton size="small" onClick={onBackspace} disabled={!pin}>
                    <BackspaceRoundedIcon fontSize="small" />
                  </IconButton>
                  <Button size="small" variant="outlined" onClick={onClear} disabled={!pin} sx={{ fontWeight: 900, borderRadius: 999 }}>
                    Clear
                  </Button>
                </Box>
              </Box>

              {/* Keypad */}
              <Box
                sx={{
                  mt: 1.5,
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: "repeat(3, 1fr)",
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <KeyButton key={n} label={n} onClick={() => onPinDigit(n)} />
                ))}

                <KeyButton label="↩" onClick={submitCheckin} variant="contained" />
                <KeyButton label="0" onClick={() => onPinDigit(0)} />
                <KeyButton label={<KeyboardArrowRightRoundedIcon />} onClick={submitCheckin} variant="contained" />
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Button
                fullWidth
                variant="outlined"
                sx={{ fontWeight: 950, borderRadius: 3 }}
                endIcon={<KeyboardArrowRightRoundedIcon />}
                onClick={submitCheckin}
                disabled={!selectedPerson}
              >
                Confirm Checkin
              </Button>
            </Box>

            {/* RIGHT: Recent checkin */}
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ fontWeight: 950 }}>Recent Checkin</Typography>
                <SmallPill>{selectedDate === todayISO ? "Today" : selectedDate}</SmallPill>
              </Box>

              <Divider sx={{ mb: 1.25 }} />

              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  maxHeight: 420,
                  overflow: "auto",
                  pr: 0.5,
                }}
              >
                {checkinsForDay.length === 0 ? (
                  <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
                    <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                      No checkins for this day.
                    </Typography>
                  </Box>
                ) : (
                  checkinsForDay.map((c) => (
                    <Box
                      key={c.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 3,
                        p: 1.1,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
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
                          {initialsFromName(c.name)}
                        </Avatar>

                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 950 }} noWrap>
                            {c.name}
                          </Typography>
                          <Typography sx={{ fontWeight: 800, fontSize: 12 }} color="text.secondary">
                            {c.kind === "member" ? "Member Checkin" : "Staff Checkin"}
                          </Typography>
                        </Box>
                      </Box>

                      <Typography sx={{ fontWeight: 900, fontSize: 12 }} color="text.secondary">
                        {fmtTime(c.atISO)}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Button
                variant="outlined"
                fullWidth
                sx={{ fontWeight: 950, borderRadius: 3 }}
                onClick={() => alert("Exit Front Desk Mode (wire later)")}
              >
                Exit FrontDesk Mode
              </Button>
            </Box>
          </Box>
        )}

        {/* SIGNUP */}
        {tab === 1 && (
          <Box sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 950, mb: 0.6 }}>Signup</Typography>
            <Typography sx={{ fontWeight: 800 }} color="text.secondary">
             <AddPerson /> 
            </Typography>

            <Box sx={{ mt: 2, display: "flex", gap: 1.2, flexWrap: "wrap" }}>
              <Button variant="contained" sx={{ fontWeight: 950 }}>
                Create New Member
              </Button>
              <Button variant="outlined" sx={{ fontWeight: 900 }}>
                Create Visitor Session
              </Button>
            </Box>
          </Box>
        )}

        {/* PRODUCT SALE */}
        {tab === 2 && (
          <Box sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 950, mb: 0.6 }}>Product Sale</Typography>
            <Typography sx={{ fontWeight: 800 }} color="text.secondary">
              Will connect to Products inventory + checkout.
            </Typography>
          </Box>
        )}

        {/* OPERATIONS */}
        {tab === 3 && (
          <Box sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 950, mb: 0.6 }}>Operations</Typography>
            <Typography sx={{ fontWeight: 800 }} color="text.secondary">
              Operations quick actions will be wired here.
            </Typography>
          </Box>
        )}
      </GemCard>
    </Box>
  );
}
export default FrontDesk;