import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EditIcon from "@mui/icons-material/Edit";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddIcon from "@mui/icons-material/Add";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SendIcon from "@mui/icons-material/Send";

import {
  Avatar,
  Box,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
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
import { alpha, useTheme } from "@mui/material/styles";

import GemDialog from "../components/ui/GemDialog";
import GemCard from "../components/ui/GemCard";

const MEMBERS_LS_KEY = "gem_members_v1";
const DETAILS_KEY = (id) => `gem_member_details_v1_${id}`;
const MEMBERSHIP_KEY = (id) => `gem_member_membership_v1_${id}`;
const PAYMENTS_KEY = (id) => `gem_member_payments_v1_${id}`;
const ATTENDANCE_KEY = (id) => `gem_member_attendance_v1_${id}`;
const MESSAGES_KEY = (id) => `gem_member_messages_v1_${id}`;
const NOTES_KEY = (id) => `gem_member_notes_v1_${id}`;

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
function fmtDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString();
  } catch {
    return iso;
  }
}
function fmtMoney(n) {
  return Number(n || 0).toLocaleString();
}
function initials(firstName, lastName) {
  const a = (firstName || "").trim()[0] || "";
  const b = (lastName || "").trim()[0] || "";
  return (a + b).toUpperCase() || "ME";
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

// ✅ IMPORTANT: address can be string OR object OR null
function formatAddress(addr) {
  if (!addr) return "-";
  if (typeof addr === "string") return addr;

  if (typeof addr === "object") {
    const parts = [
      addr.streetNumber,
      addr.streetName,
      addr.city,
      addr.postalCode,
      addr.country,
    ].filter(Boolean);

    return parts.length ? parts.join(", ") : "-";
  }

  return String(addr);
}

// ✅ emergencyContact can be string OR object
function formatEmergencyContact(ec) {
  if (!ec) return "-";
  if (typeof ec === "string") return ec;

  if (typeof ec === "object") {
    const parts = [ec.name, ec.phone, ec.relation].filter(Boolean);
    return parts.length ? parts.join(" • ") : "-";
  }

  return String(ec);
}

// ✅ normalize membership because your AddMemberVisitorPage stores {option, price, sessionQty}
function normalizeMembership(m) {
  if (!m) return null;

  // already in profile format
  if (typeof m === "object" && ("plan" in m || "cost" in m)) {
    return {
      plan: m.plan ?? "—",
      cost: Number(m.cost ?? 0),
      amountPaid: Number(m.amountPaid ?? 0),
      amountOwing: Number(m.amountOwing ?? Math.max(0, Number(m.cost ?? 0) - Number(m.amountPaid ?? 0))),
      startDate: m.startDate ?? "",
      endDate: m.endDate ?? "",
      sessionQty: m.sessionQty ?? undefined,
    };
  }

  // add-member format
  if (typeof m === "object" && "option" in m) {
    const cost = Number(m.price ?? 0);
    const paid = Number(m.amountPaid ?? 0);
    return {
      plan: String(m.option || "—"),
      cost,
      amountPaid: paid,
      amountOwing: Number(m.amountOwing ?? Math.max(0, cost - paid)),
      startDate: m.startDate ?? "",
      endDate: m.endDate ?? "",
      sessionQty: m.sessionQty ?? undefined,
    };
  }

  return null;
}

function ensureSeed(member) {
  const memberId = member.id;

  // Details
  const existingDetails = getJSON(DETAILS_KEY(memberId), null);
  if (!existingDetails) {
    const email = `${(member.firstName || "user").toLowerCase()}.${(member.lastName || "member").toLowerCase()}38@gmail.com`;
    setJSON(DETAILS_KEY(memberId), {
      phone: member.phone || "343-888-9766",
      email,
      address: "Centre D'handicap",
      emergencyContact: "343-988-9755",
      checkingCode: "12**",
      status: "Active Membership",
      profileExpiry: member.expiry || "",
      owing: member.amountOwing ?? 0,
    });
  }

  // Current membership
  const existingMembership = getJSON(MEMBERSHIP_KEY(memberId), null);
  if (!existingMembership) {
    setJSON(MEMBERSHIP_KEY(memberId), {
      plan: "Elite Plus",
      cost: 20000,
      amountPaid: 12500,
      amountOwing: 7500,
      startDate: "2025-11-12",
      endDate: "2025-12-12",
    });
  }

  // Payment history
  const existingPayments = getJSON(PAYMENTS_KEY(memberId), null);
  if (!existingPayments) {
    setJSON(PAYMENTS_KEY(memberId), [
      { id: createId("pay"), date: "2025-11-12", amount: 12500, category: "Registration", method: "Cash" },
      { id: createId("pay"), date: "2025-11-12", amount: 12500, category: "Registration", method: "Cash" },
      { id: createId("pay"), date: "2025-11-12", amount: 12500, category: "Registration", method: "Cash" },
      { id: createId("pay"), date: "2025-11-12", amount: 12500, category: "Registration", method: "Cash" },
    ]);
  }

  // Attendance
  const existingAttendance = getJSON(ATTENDANCE_KEY(memberId), null);
  if (!existingAttendance) {
    setJSON(ATTENDANCE_KEY(memberId), [
      { id: createId("p"), no: 13, date: "2025-11-12", time: "08:24" },
      { id: createId("p"), no: 12, date: "2025-11-12", time: "08:24" },
      { id: createId("p"), no: 11, date: "2025-11-12", time: "08:24" },
    ]);
  }

  // Messages
  const existingMessages = getJSON(MESSAGES_KEY(memberId), null);
  if (!existingMessages) {
    setJSON(MESSAGES_KEY(memberId), [
      { id: createId("msg"), date: "2025-11-12", title: "Late on Payment", category: "Owing", media: "Text", message: "Just a reminder..." },
      { id: createId("msg"), date: "2025-11-12", title: "Late on Payment", category: "Owing", media: "Text", message: "Just a reminder..." },
    ]);
  }

  // Notes
  const existingNotes = getJSON(NOTES_KEY(memberId), null);
  if (!existingNotes) {
    setJSON(NOTES_KEY(memberId), [
      { id: createId("note"), date: "2025-11-12", staff: "Foyet", category: "Complaint", note: "Customer is not re..." },
      { id: createId("note"), date: "2025-11-12", staff: "Foyet", category: "Complaint", note: "Customer is not re..." },
    ]);
  }
}

function DateFilter({ value, onChange, width = 180 }) {
  return (
    <FormControl size="small" sx={{ width }}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} sx={{ fontWeight: 900 }}>
        <MenuItem value="all">Filter: All</MenuItem>
        <MenuItem value="7">Last 7 days</MenuItem>
        <MenuItem value="30">Last 30 days</MenuItem>
        <MenuItem value="month">This month</MenuItem>
      </Select>
    </FormControl>
  );
}

function applyDateFilter(rows, filterValue) {
  if (!rows?.length) return [];
  if (filterValue === "all") return rows;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const toDate = (iso) => new Date((iso || "1970-01-01") + "T00:00:00");

  if (filterValue === "month") {
    return rows.filter((r) => toDate(r.date) >= startOfMonth);
  }

  const days = Number(filterValue);
  if (!Number.isFinite(days)) return rows;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return rows.filter((r) => toDate(r.date) >= cutoff);
}

function RowActionsMenu({ onView, onDelete }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onView?.();
          }}
        >
          View
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onDelete?.();
          }}
          sx={{ color: "error.main", fontWeight: 900 }}
        >
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}

/** ------------------ PAGE ------------------ **/
function MemberProfile() {
  const { memberId } = useParams();
  const theme = useTheme();
  const navigate = useNavigate();

  const [member, setMember] = useState(null);
  const [details, setDetails] = useState(null);
  const [membership, setMembership] = useState(null);

  const [payments, setPayments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [messages, setMessages] = useState([]);
  const [notes, setNotes] = useState([]);

  const [payFilter, setPayFilter] = useState("all");
  const [attFilter, setAttFilter] = useState("all");
  const [msgFilter, setMsgFilter] = useState("all");

  // dialogs
  const [openChangeMembership, setOpenChangeMembership] = useState(false);
  const [openAddPayment, setOpenAddPayment] = useState(false);
  const [openAddPunch, setOpenAddPunch] = useState(false);
  const [openSendMessage, setOpenSendMessage] = useState(false);
  const [openAddNote, setOpenAddNote] = useState(false);

  const [viewItem, setViewItem] = useState({ open: false, title: "", body: "" });

  // forms
  const [membershipForm, setMembershipForm] = useState({
    plan: "Elite Plus",
    cost: 20000,
    amountPaid: 0,
    startDate: "",
    endDate: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    date: "",
    amount: "",
    category: "Registration",
    method: "Cash",
  });

  const [punchForm, setPunchForm] = useState({
    date: "",
    time: "",
  });

  const [messageForm, setMessageForm] = useState({
    date: "",
    title: "",
    category: "Owing",
    media: "Text",
    message: "",
  });

  const [noteForm, setNoteForm] = useState({
    date: "",
    staff: "Myself",
    category: "General",
    note: "",
  });

  // Load member from members list
  useEffect(() => {
    const list = getJSON(MEMBERS_LS_KEY, []);
    const found = (list || []).find((m) => String(m.id) === String(memberId));
    if (!found) {
      setMember(null);
      return;
    }

    setMember(found);
    ensureSeed(found);

    const det = getJSON(DETAILS_KEY(found.id), null);
    setDetails(det);

    // ✅ normalize membership shape for members created from AddMemberVisitorPage
    const rawMem = getJSON(MEMBERSHIP_KEY(found.id), null);
    const norm = normalizeMembership(rawMem);
    setMembership(norm);
    if (rawMem && norm && JSON.stringify(rawMem) !== JSON.stringify(norm)) {
      setJSON(MEMBERSHIP_KEY(found.id), norm);
    }

    setPayments(getJSON(PAYMENTS_KEY(found.id), []));
    setAttendance(getJSON(ATTENDANCE_KEY(found.id), []));
    setMessages(getJSON(MESSAGES_KEY(found.id), []));
    setNotes(getJSON(NOTES_KEY(found.id), []));
  }, [memberId]);

  // Derived data
  const filteredPayments = useMemo(() => applyDateFilter(payments, payFilter), [payments, payFilter]);
  const filteredAttendance = useMemo(() => applyDateFilter(attendance, attFilter), [attendance, attFilter]);
  const filteredMessages = useMemo(() => applyDateFilter(messages, msgFilter), [messages, msgFilter]);

  const fullName = member ? `${member.firstName} ${member.lastName}` : "Member";
  const avatarText = member ? initials(member.firstName, member.lastName) : "ME";

  const membershipOwing = membership?.amountOwing ?? 0;
  const profileOwing = details?.owing ?? (member?.amountOwing ?? 0);

  // Save helpers
  const persistMembership = (next) => {
    const normalized = normalizeMembership(next);
    setMembership(normalized);
    if (member?.id) setJSON(MEMBERSHIP_KEY(member.id), normalized);
  };
  const persistDetails = (next) => {
    setDetails(next);
    if (member?.id) setJSON(DETAILS_KEY(member.id), next);
  };
  const persistPayments = (next) => {
    setPayments(next);
    if (member?.id) setJSON(PAYMENTS_KEY(member.id), next);
  };
  const persistAttendance = (next) => {
    setAttendance(next);
    if (member?.id) setJSON(ATTENDANCE_KEY(member.id), next);
  };
  const persistMessages = (next) => {
    setMessages(next);
    if (member?.id) setJSON(MESSAGES_KEY(member.id), next);
  };
  const persistNotes = (next) => {
    setNotes(next);
    if (member?.id) setJSON(NOTES_KEY(member.id), next);
  };

  const openView = (title, bodyObj) => {
    setViewItem({ open: true, title, body: JSON.stringify(bodyObj, null, 2) });
  };

  if (!member) {
    return (
      <Box sx={{ display: "grid", gap: 2 }}>
        <GemCard contentSx={{ p: 3 }}>
          <Typography sx={{ fontWeight: 950, fontSize: 18 }}>Member not found</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            This member ID doesn’t exist in your local data.
          </Typography>
        </GemCard>
      </Box>
    );
  }

  // ✅ safe strings for rendering (prevents React object crash)
  const addressText = formatAddress(details?.address);
  const emergencyText = formatEmergencyContact(details?.emergencyContact);

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
        alignItems: "start",
      }}
    >
      {/* LEFT PROFILE SUMMARY */}
      <GemCard contentSx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <IconButton
            onClick={() => navigate(-1)}
            aria-label="Close member profile"
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
              {avatarText}
            </Avatar>

            <IconButton
              size="small"
              sx={{
                position: "absolute",
                right: -6,
                top: -6,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: 1,
                "&:hover": { bgcolor: "background.paper" },
              }}
              onClick={() => alert("Profile edit will be implemented later.")}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ textAlign: "center", mt: 1.2 }}>
          <Typography sx={{ fontWeight: 950, fontSize: 20 }}>{fullName}</Typography>

          <Chip
            label={details?.status || "Active Membership"}
            size="small"
            sx={{
              mt: 0.8,
              fontWeight: 900,
              bgcolor: alpha(theme.palette.primary.main, 0.10),
              color: theme.palette.primary.main,
            }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: "grid", gap: 1.2 }}>
          <InfoRow label="Phone" value={details?.phone || member.phone || "-"} />
          <InfoRow label="Email" value={details?.email || "-"} />

          {/* ✅ FIXED */}
          <InfoRow label="Address" value={addressText} />
          <InfoRow label="Emergency Contact" value={emergencyText} />

          <InfoRow
            label="Checking Code"
            value={details?.checkingCode || "—"}
            rightIcon="👁️"
            onRightIconClick={() => alert("We’ll add secure reveal later.")}
          />

          <InfoRow
            label="Owing"
            value={`${fmtMoney(profileOwing)} XAF`}
            valueSx={{ fontWeight: 950, color: profileOwing > 0 ? "error.main" : "text.primary" }}
          />

          <InfoRow label="Profile Expiry" value={fmtDate(details?.profileExpiry || member.expiry)} />
          <InfoRow
            label="Membership Owing"
            value={`${fmtMoney(membershipOwing)} XAF`}
            valueSx={{ fontWeight: 950, color: membershipOwing > 0 ? "error.main" : "text.primary" }}
          />
        </Box>
      </GemCard>

      {/* RIGHT CONTENT */}
      <Box sx={{ display: "grid", gap: 2 }}>
        {/* CURRENT MEMBERSHIP */}
        <GemCard contentSx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Typography sx={{ fontWeight: 950 }}>Current Membership</Typography>
            <Button
              variant="outlined"
              startIcon={<SwapHorizIcon />}
              onClick={() => {
                setMembershipForm({
                  plan: membership?.plan || "Elite Plus",
                  cost: membership?.cost || 20000,
                  amountPaid: membership?.amountPaid || 0,
                  startDate: membership?.startDate || "",
                  endDate: membership?.endDate || "",
                });
                setOpenChangeMembership(true);
              }}
              sx={{ fontWeight: 900 }}
            >
              Change Membership
            </Button>
          </Box>

          <Box sx={{ mt: 1.5 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Plan</TableCell>
                    <TableCell>Cost</TableCell>
                    <TableCell>Amount Paid</TableCell>
                    <TableCell>Amount Owing</TableCell>
                    <TableCell>Start Date</TableCell>
                    <TableCell>End Date</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow sx={{ "& td": { borderBottom: "1px solid", borderColor: "divider" } }}>
                    <TableCell sx={{ fontWeight: 900 }}>{membership?.plan || "-"}</TableCell>
                    <TableCell>{fmtMoney(membership?.cost)} XAF</TableCell>
                    <TableCell>{fmtMoney(membership?.amountPaid)} XAF</TableCell>
                    <TableCell sx={{ fontWeight: 900, color: (membership?.amountOwing || 0) > 0 ? "error.main" : "text.primary" }}>
                      {fmtMoney(membership?.amountOwing)} XAF
                    </TableCell>
                    <TableCell>{fmtDate(membership?.startDate)}</TableCell>
                    <TableCell>{fmtDate(membership?.endDate)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => openView("Current Membership", membership)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </GemCard>

        {/* PAYMENT HISTORY */}
        <GemCard contentSx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 950 }}>Payment History</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => {
                  setPaymentForm({ date: todayISO(), amount: "", category: "Registration", method: "Cash" });
                  setOpenAddPayment(true);
                }}
                sx={{ fontWeight: 900 }}
              >
                Add Payment
              </Button>
              <DateFilter value={payFilter} onChange={setPayFilter} />
            </Box>
          </Box>

          <Box sx={{ mt: 1.5 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPayments.map((p) => (
                    <TableRow key={p.id} sx={{ "& td": { borderBottom: "1px solid", borderColor: "divider" } }}>
                      <TableCell>{fmtDate(p.date)}</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>{fmtMoney(p.amount)} XAF</TableCell>
                      <TableCell>{p.category}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell align="right">
                        <RowActionsMenu
                          onView={() => openView("Payment", p)}
                          onDelete={() => persistPayments(payments.filter((x) => x.id !== p.id))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredPayments.length === 0 && <EmptyRow colSpan={5} text="No payments found for this filter." />}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </GemCard>

        {/* ATTENDANCE */}
        <GemCard contentSx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 950 }}>Attendance</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => {
                  setPunchForm({ date: todayISO(), time: nowTimeHHMM() });
                  setOpenAddPunch(true);
                }}
                sx={{ fontWeight: 900 }}
              >
                Add Punch
              </Button>
              <DateFilter value={attFilter} onChange={setAttFilter} />
            </Box>
          </Box>

          <Box sx={{ mt: 1.5 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>NO</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAttendance.map((a) => (
                    <TableRow key={a.id} sx={{ "& td": { borderBottom: "1px solid", borderColor: "divider" } }}>
                      <TableCell sx={{ fontWeight: 900 }}>{a.no}</TableCell>
                      <TableCell>{fmtDate(a.date)}</TableCell>
                      <TableCell>{a.time}</TableCell>
                      <TableCell align="right">
                        <RowActionsMenu
                          onView={() => openView("Punch", a)}
                          onDelete={() => persistAttendance(attendance.filter((x) => x.id !== a.id))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredAttendance.length === 0 && <EmptyRow colSpan={4} text="No punches found for this filter." />}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </GemCard>

        {/* MESSAGE */}
        <GemCard contentSx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 950 }}>Message</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }}>
              <Button
                variant="outlined"
                startIcon={<SendIcon />}
                onClick={() => {
                  setMessageForm({ date: todayISO(), title: "", category: "Owing", media: "Text", message: "" });
                  setOpenSendMessage(true);
                }}
                sx={{ fontWeight: 900 }}
              >
                Send a new message
              </Button>
              <DateFilter value={msgFilter} onChange={setMsgFilter} />
            </Box>
          </Box>

          <Box sx={{ mt: 1.5 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Media</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredMessages.map((m) => (
                    <TableRow key={m.id} sx={{ "& td": { borderBottom: "1px solid", borderColor: "divider" } }}>
                      <TableCell>{fmtDate(m.date)}</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>{m.title}</TableCell>
                      <TableCell>{m.category}</TableCell>
                      <TableCell>{m.media}</TableCell>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography noWrap title={m.message}>
                          {m.message}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <RowActionsMenu
                          onView={() => openView("Message", m)}
                          onDelete={() => persistMessages(messages.filter((x) => x.id !== m.id))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredMessages.length === 0 && <EmptyRow colSpan={6} text="No messages found for this filter." />}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </GemCard>

        {/* NOTES */}
        <GemCard contentSx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 950 }}>Notes</Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                setNoteForm({ date: todayISO(), staff: "Myself", category: "General", note: "" });
                setOpenAddNote(true);
              }}
              sx={{ fontWeight: 900 }}
            >
              Add note
            </Button>
          </Box>

          <Box sx={{ mt: 1.5 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Staff</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {notes.map((n) => (
                    <TableRow key={n.id} sx={{ "& td": { borderBottom: "1px solid", borderColor: "divider" } }}>
                      <TableCell>{fmtDate(n.date)}</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>{n.staff}</TableCell>
                      <TableCell>{n.category}</TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Typography noWrap title={n.note}>
                          {n.note}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <RowActionsMenu
                          onView={() => openView("Note", n)}
                          onDelete={() => persistNotes(notes.filter((x) => x.id !== n.id))}
                        />
                      </TableCell>
                    </TableRow>
                  ))}

                  {notes.length === 0 && <EmptyRow colSpan={5} text="No notes yet." />}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </GemCard>
      </Box>

      {/* VIEW DIALOG */}
      <GemDialog open={viewItem.open} onClose={() => setViewItem((s) => ({ ...s, open: false }))} fullWidth maxWidth="sm">
        <DialogTitle>{viewItem.title}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField value={viewItem.body} fullWidth multiline minRows={10} inputProps={{ readOnly: true }} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setViewItem((s) => ({ ...s, open: false }))}>Close</Button>
        </DialogActions>
      </GemDialog>

      {/* CHANGE MEMBERSHIP DIALOG */}
      <GemDialog open={openChangeMembership} onClose={() => setOpenChangeMembership(false)} fullWidth maxWidth="sm">
        <DialogTitle>Change Membership</DialogTitle>
        <DialogContent sx={{ pt: 2.5, display: "grid", gap: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="plan">Plan</InputLabel>
            <Select
              labelId="plan"
              label="Plan"
              value={membershipForm.plan}
              onChange={(e) => setMembershipForm((s) => ({ ...s, plan: e.target.value }))}
            >
              <MenuItem value="Elite Plus">Elite Plus</MenuItem>
              <MenuItem value="Elite Standard">Elite Standard</MenuItem>
              <MenuItem value="Student">Student</MenuItem>
              <MenuItem value="VIP">VIP</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <TextField
              label="Cost (XAF)"
              size="small"
              type="number"
              value={membershipForm.cost}
              onChange={(e) => setMembershipForm((s) => ({ ...s, cost: Number(e.target.value || 0) }))}
            />
            <TextField
              label="Amount Paid (XAF)"
              size="small"
              type="number"
              value={membershipForm.amountPaid}
              onChange={(e) => setMembershipForm((s) => ({ ...s, amountPaid: Number(e.target.value || 0) }))}
            />
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <TextField
              label="Start Date"
              size="small"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={membershipForm.startDate}
              onChange={(e) => setMembershipForm((s) => ({ ...s, startDate: e.target.value }))}
            />
            <TextField
              label="End Date"
              size="small"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={membershipForm.endDate}
              onChange={(e) => setMembershipForm((s) => ({ ...s, endDate: e.target.value }))}
            />
          </Box>

          <Typography variant="body2" color="text.secondary">
            Amount owing will be calculated automatically.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenChangeMembership(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const amountOwing = Math.max(
                0,
                Number(membershipForm.cost || 0) - Number(membershipForm.amountPaid || 0)
              );
              const next = {
                plan: membershipForm.plan,
                cost: Number(membershipForm.cost || 0),
                amountPaid: Number(membershipForm.amountPaid || 0),
                amountOwing,
                startDate: membershipForm.startDate,
                endDate: membershipForm.endDate,
              };
              persistMembership(next);

              // sync profile expiry in left panel
              persistDetails({
                ...(details || {}),
                profileExpiry: membershipForm.endDate || (details?.profileExpiry || ""),
              });

              setOpenChangeMembership(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </GemDialog>

      {/* ADD PAYMENT */}
      <GemDialog open={openAddPayment} onClose={() => setOpenAddPayment(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Payment</DialogTitle>
        <DialogContent sx={{ pt: 2.5, display: "grid", gap: 2 }}>
          <TextField
            label="Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={paymentForm.date}
            onChange={(e) => setPaymentForm((s) => ({ ...s, date: e.target.value }))}
          />
          <TextField
            label="Amount (XAF)"
            type="number"
            size="small"
            value={paymentForm.amount}
            onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))}
          />
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <FormControl fullWidth size="small">
              <InputLabel id="paycat">Category</InputLabel>
              <Select
                labelId="paycat"
                label="Category"
                value={paymentForm.category}
                onChange={(e) => setPaymentForm((s) => ({ ...s, category: e.target.value }))}
              >
                <MenuItem value="Registration">Registration</MenuItem>
                <MenuItem value="Monthly">Monthly</MenuItem>
                <MenuItem value="Top-up">Top-up</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="paymethod">Method</InputLabel>
              <Select
                labelId="paymethod"
                label="Method"
                value={paymentForm.method}
                onChange={(e) => setPaymentForm((s) => ({ ...s, method: e.target.value }))}
              >
                <MenuItem value="Cash">Cash</MenuItem>
                <MenuItem value="POS">POS</MenuItem>
                <MenuItem value="Mobile Money">Mobile Money</MenuItem>
                <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAddPayment(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const entry = {
                id: createId("pay"),
                date: paymentForm.date || todayISO(),
                amount: Number(paymentForm.amount || 0),
                category: paymentForm.category,
                method: paymentForm.method,
              };
              const next = [entry, ...payments];
              persistPayments(next);

              const newPaid = Number(membership?.amountPaid || 0) + entry.amount;
              const cost = Number(membership?.cost || 0);
              const newOwing = Math.max(0, cost - newPaid);
              persistMembership({ ...(membership || {}), amountPaid: newPaid, amountOwing: newOwing });

              setOpenAddPayment(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </GemDialog>

      {/* ADD PUNCH */}
      <GemDialog open={openAddPunch} onClose={() => setOpenAddPunch(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Punch</DialogTitle>
        <DialogContent sx={{ pt: 2.5, display: "grid", gap: 2 }}>
          <TextField
            label="Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={punchForm.date}
            onChange={(e) => setPunchForm((s) => ({ ...s, date: e.target.value }))}
          />
          <TextField
            label="Time"
            type="time"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={punchForm.time}
            onChange={(e) => setPunchForm((s) => ({ ...s, time: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAddPunch(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const maxNo = Math.max(0, ...(attendance.map((a) => Number(a.no || 0))));
              const entry = {
                id: createId("p"),
                no: maxNo + 1,
                date: punchForm.date || todayISO(),
                time: punchForm.time || nowTimeHHMM(),
              };
              persistAttendance([entry, ...attendance]);
              setOpenAddPunch(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </GemDialog>

      {/* SEND MESSAGE */}
      <GemDialog open={openSendMessage} onClose={() => setOpenSendMessage(false)} fullWidth maxWidth="sm">
        <DialogTitle>Send a new message</DialogTitle>
        <DialogContent sx={{ pt: 2.5, display: "grid", gap: 2 }}>
          <TextField
            label="Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={messageForm.date}
            onChange={(e) => setMessageForm((s) => ({ ...s, date: e.target.value }))}
          />
          <TextField
            label="Title"
            size="small"
            value={messageForm.title}
            onChange={(e) => setMessageForm((s) => ({ ...s, title: e.target.value }))}
          />
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <FormControl fullWidth size="small">
              <InputLabel id="msgcat">Category</InputLabel>
              <Select
                labelId="msgcat"
                label="Category"
                value={messageForm.category}
                onChange={(e) => setMessageForm((s) => ({ ...s, category: e.target.value }))}
              >
                <MenuItem value="Owing">Owing</MenuItem>
                <MenuItem value="Reminder">Reminder</MenuItem>
                <MenuItem value="Promotion">Promotion</MenuItem>
                <MenuItem value="General">General</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="msgmedia">Media</InputLabel>
              <Select
                labelId="msgmedia"
                label="Media"
                value={messageForm.media}
                onChange={(e) => setMessageForm((s) => ({ ...s, media: e.target.value }))}
              >
                <MenuItem value="Text">Text</MenuItem>
                <MenuItem value="Email">Email</MenuItem>
                <MenuItem value="WhatsApp">WhatsApp</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TextField
            label="Message"
            size="small"
            multiline
            minRows={4}
            value={messageForm.message}
            onChange={(e) => setMessageForm((s) => ({ ...s, message: e.target.value }))}
          />
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenSendMessage(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const entry = {
                id: createId("msg"),
                date: messageForm.date || todayISO(),
                title: messageForm.title || "Message",
                category: messageForm.category,
                media: messageForm.media,
                message: messageForm.message || "",
              };
              persistMessages([entry, ...messages]);
              setOpenSendMessage(false);
            }}
          >
            Send
          </Button>
        </DialogActions>
      </GemDialog>

      {/* ADD NOTE */}
      <GemDialog open={openAddNote} onClose={() => setOpenAddNote(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add note</DialogTitle>
        <DialogContent sx={{ pt: 2.5, display: "grid", gap: 2 }}>
          <TextField
            label="Date"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={noteForm.date}
            onChange={(e) => setNoteForm((s) => ({ ...s, date: e.target.value }))}
          />
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <TextField
              label="Staff"
              size="small"
              value={noteForm.staff}
              onChange={(e) => setNoteForm((s) => ({ ...s, staff: e.target.value }))}
            />
            <FormControl fullWidth size="small">
              <InputLabel id="notecat">Category</InputLabel>
              <Select
                labelId="notecat"
                label="Category"
                value={noteForm.category}
                onChange={(e) => setNoteForm((s) => ({ ...s, category: e.target.value }))}
              >
                <MenuItem value="General">General</MenuItem>
                <MenuItem value="Complaint">Complaint</MenuItem>
                <MenuItem value="Warning">Warning</MenuItem>
                <MenuItem value="Praise">Praise</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TextField
            label="Notes"
            size="small"
            multiline
            minRows={4}
            value={noteForm.note}
            onChange={(e) => setNoteForm((s) => ({ ...s, note: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAddNote(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const entry = {
                id: createId("note"),
                date: noteForm.date || todayISO(),
                staff: noteForm.staff || "Myself",
                category: noteForm.category,
                note: noteForm.note || "",
              };
              persistNotes([entry, ...notes]);
              setOpenAddNote(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </GemDialog>
    </Box>
  );
}

/** ------- small UI helpers ------- **/
function InfoRow({ label, value, valueSx, rightIcon, onRightIconClick }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
        {label}:
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 900, ...valueSx, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 190 }}
          title={typeof value === "string" ? value : ""}
        >
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

function EmptyRow({ colSpan, text }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan}>
        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
          <Typography sx={{ fontWeight: 900 }} color="text.secondary">
            {text}
          </Typography>
        </Box>
      </TableCell>
    </TableRow>
  );
}

export default MemberProfile;
