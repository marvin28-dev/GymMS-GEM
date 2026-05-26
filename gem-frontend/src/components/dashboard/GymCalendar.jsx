import { useMemo, useState, useEffect } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  Divider,
} from "@mui/material";
import { getAll as getStaff } from "../../services/staff.service";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import GemCard from "../ui/GemCard";
import GemDialog from "../ui/GemDialog";

import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  getDay,
  isAfter,
  parse,
  startOfWeek,
} from "date-fns";
import enUS from "date-fns/locale/en-US";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const LS_KEY = "gem_calendar_events";

/**
 * A small palette of mature colors that fit the indigo theme.
 * We'll rotate through these automatically per event.
 */
const EVENT_COLORS = [
  "#4338CA", // indigo
  "#0EA5E9", // sky
  "#10B981", // emerald
  "#F59E0B", // amber
  "#8B5CF6", // violet
  "#EF4444", // red
  "#14B8A6", // teal
];

function loadEvents() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((e) => ({
      ...e,
      start: new Date(e.start),
      end: new Date(e.end),
    }));
  } catch {
    return [];
  }
}

function saveEvents(events) {
  localStorage.setItem(
    LS_KEY,
    JSON.stringify(
      events.map((e) => ({
        ...e,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
      }))
    )
  );
}

function setTime(baseDate, timeStr) {
  const [hh, mm] = timeStr.split(":").map((v) => Number(v));
  const d = new Date(baseDate);
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d;
}

function ymd(date) {
  return format(date, "yyyy-MM-dd");
}

function pickColor(index) {
  return EVENT_COLORS[index % EVENT_COLORS.length];
}

function generateRecurringEvents({
  title,
  description,
  start,
  end,
  repeat,
  repeatUntil,
  customDays,
  assignedStaff = [],
}) {
  const events = [];
  const seriesId = crypto.randomUUID();

  const pushOcc = (s, e) => {
    events.push({
      id: crypto.randomUUID(),
      seriesId,
      title,
      description,
      start: s,
      end: e,
      repeat,
      repeatUntil: repeatUntil ? repeatUntil.toISOString() : null,
      customDays: Array.isArray(customDays) ? customDays : [],
      assignedStaff,
      colorIndex: 0,
    });
  };

  // Always include the first occurrence
  pushOcc(start, end);

  if (repeat === "none") return events;

  // Default: 30 days if not provided
  const until = repeatUntil ? new Date(repeatUntil) : addDays(start, 30);
  if (isAfter(start, until)) return events;

  if (repeat === "daily") {
    let cur = addDays(start, 1);
    while (!isAfter(cur, until)) {
      const s = new Date(cur);
      const e = new Date(cur);
      s.setHours(start.getHours(), start.getMinutes(), 0, 0);
      e.setHours(end.getHours(), end.getMinutes(), 0, 0);
      pushOcc(s, e);
      cur = addDays(cur, 1);
    }
  }

  if (repeat === "weekly") {
    let cur = addWeeks(start, 1);
    while (!isAfter(cur, until)) {
      const s = new Date(cur);
      const e = new Date(cur);
      s.setHours(start.getHours(), start.getMinutes(), 0, 0);
      e.setHours(end.getHours(), end.getMinutes(), 0, 0);
      pushOcc(s, e);
      cur = addWeeks(cur, 1);
    }
  }

  if (repeat === "monthly") {
    let cur = addMonths(start, 1);
    while (!isAfter(cur, until)) {
      const s = new Date(cur);
      const e = new Date(cur);
      s.setHours(start.getHours(), start.getMinutes(), 0, 0);
      e.setHours(end.getHours(), end.getMinutes(), 0, 0);
      pushOcc(s, e);
      cur = addMonths(cur, 1);
    }
  }

  if (repeat === "custom_days") {
    const days = Array.isArray(customDays) ? customDays : [];
    if (days.length === 0) return events;

    let cur = addDays(start, 1);
    while (!isAfter(cur, until)) {
      const dow = cur.getDay(); // 0..6
      if (days.includes(dow)) {
        const s = new Date(cur);
        const e = new Date(cur);
        s.setHours(start.getHours(), start.getMinutes(), 0, 0);
        e.setHours(end.getHours(), end.getMinutes(), 0, 0);
        pushOcc(s, e);
      }
      cur = addDays(cur, 1);
    }
  }

  return events;
}

function repeatLabel(evt) {
  if (!evt?.repeat || evt.repeat === "none") return "No repeat";
  if (evt.repeat === "daily") return "Repeats daily";
  if (evt.repeat === "weekly") return "Repeats weekly";
  if (evt.repeat === "monthly") return "Repeats monthly";
  if (evt.repeat === "custom_days") return "Repeats on selected days";
  return "Repeat";
}

export default function GymCalendar() {
  const [allStaff, setAllStaff] = useState([]);
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    getStaff().then(res => setAllStaff((res.data || []).map(s => ({
      ...s,
      name: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
    })))).catch(() => {});
  }, []);

  const [events, setEvents] = useState(() => {
    const loaded = loadEvents();
    // ensure each event has a colorIndex
    return loaded.map((e, idx) => ({
      ...e,
      colorIndex: Number.isFinite(e.colorIndex) ? e.colorIndex : idx % EVENT_COLORS.length,
    }));
  });

  const label = useMemo(() => format(date, "MMMM"), [date]);
  const year = useMemo(() => format(date, "yyyy"), [date]);

  // Add dialog
  const [openAdd, setOpenAdd] = useState(false);
  const [slotDate, setSlotDate] = useState(new Date());

  // Details dialog
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const emptyForm = {
    title: "",
    description: "",
    startTime: "09:00",
    endTime: "10:00",
    repeat: "none",
    repeatUntil: "",
    customDays: { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false },
    assignedStaff: [],
  };

  const [form, setForm] = useState(emptyForm);

  function openAddDialog(d) {
    setSlotDate(d);
    setOpenAdd(true);
    setForm(emptyForm);
  }

  function handleSaveEvent() {
    if (!form.title) return;

    const baseDay = new Date(slotDate);
    baseDay.setHours(0, 0, 0, 0);

    const start = setTime(baseDay, form.startTime);
    const end = setTime(baseDay, form.endTime);
    if (end <= start) return;

    const customDays = Object.entries(form.customDays)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));

    const repeatUntilDate = form.repeatUntil ? new Date(form.repeatUntil + "T23:59:59") : null;

    const newEvents = generateRecurringEvents({
      title: form.title,
      description: form.description,
      start,
      end,
      repeat: form.repeat,
      repeatUntil: repeatUntilDate,
      customDays,
      assignedStaff: form.assignedStaff,
    });

    // assign unique colors to each "save" group (series)
    const nextColorIndex = events.length % EVENT_COLORS.length;
    const colored = newEvents.map((e) => ({
      ...e,
      colorIndex: nextColorIndex,
    }));

    const next = [...events, ...colored];
    setEvents(next);
    saveEvents(next);
    setOpenAdd(false);
  }

  function openDetailsDialog(evt) {
    setSelectedEvent(evt);
    setOpenDetails(true);
  }

  function deleteOneOccurrence(evtId) {
    const next = events.filter((e) => e.id !== evtId);
    setEvents(next);
    saveEvents(next);
    setOpenDetails(false);
  }

  function deleteSeries(seriesId) {
    const next = events.filter((e) => e.seriesId !== seriesId);
    setEvents(next);
    saveEvents(next);
    setOpenDetails(false);
  }

  // Different color per event
  const eventPropGetter = (event) => {
    const bg = pickColor(event.colorIndex ?? 0);
    return {
      className: "gem-rbc-event",
      style: {
        backgroundColor: bg,
        borderColor: bg,
      },
    };
  };

  return (
    <GemCard sx={{ height: "100%" }} contentSx={{ p: 1.5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 0.5 }}>
        <Typography sx={{ fontWeight: 900 }}>Gym Calendar</Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton size="small" onClick={() => setDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>

          <Typography sx={{ fontWeight: 800, minWidth: 90, textAlign: "center" }}>{label}</Typography>

          <IconButton size="small" onClick={() => setDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>

          <Typography sx={{ fontWeight: 800, ml: 1 }}>{year}</Typography>

          <IconButton size="small" onClick={() => openAddDialog(new Date())} title="Add activity">
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ height: 480, mt: 1 }}>
        <Calendar
          localizer={localizer}
          date={date}
          onNavigate={(d) => setDate(d)}
          view="month"
          events={events}
          startAccessor="start"
          endAccessor="end"
          selectable
          popup
          onSelectSlot={(slot) => openAddDialog(slot.start)}
          onSelectEvent={(evt) => openDetailsDialog(evt)}
          eventPropGetter={eventPropGetter}
        />
      </Box>

      {/* ADD EVENT */}
      <GemDialog open={openAdd} onClose={() => setOpenAdd(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Event</DialogTitle>
        <DialogContent sx={{ pt: 1, display: "grid", gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Date: <b>{ymd(slotDate)}</b>
          </Typography>

          <FormControl fullWidth size="small">
            <InputLabel id="repeat-label">Repeat</InputLabel>
            <Select
              labelId="repeat-label"
              label="Repeat"
              value={form.repeat}
              onChange={(e) => setForm((s) => ({ ...s, repeat: e.target.value }))}
            >
              <MenuItem value="none">No repeat</MenuItem>
              <MenuItem value="daily">Every day</MenuItem>
              <MenuItem value="weekly">Every week (same day)</MenuItem>
              <MenuItem value="monthly">Every month (same date)</MenuItem>
              <MenuItem value="custom_days">Custom days</MenuItem>
            </Select>
          </FormControl>

          {form.repeat === "custom_days" && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {[
                { k: 0, label: "Sun" },
                { k: 1, label: "Mon" },
                { k: 2, label: "Tue" },
                { k: 3, label: "Wed" },
                { k: 4, label: "Thu" },
                { k: 5, label: "Fri" },
                { k: 6, label: "Sat" },
              ].map((d) => (
                <FormControlLabel
                  key={d.k}
                  control={
                    <Checkbox
                      checked={!!form.customDays[d.k]}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          customDays: { ...s.customDays, [d.k]: e.target.checked },
                        }))
                      }
                    />
                  }
                  label={d.label}
                />
              ))}
            </Box>
          )}

          {form.repeat !== "none" && (
            <Box sx={{ display: "grid", gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
                Repeat until
              </Typography>
              <input
                type="date"
                value={form.repeatUntil}
                onChange={(e) => setForm((s) => ({ ...s, repeatUntil: e.target.value }))}
                style={{
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid #E2E8F0",
                  padding: "0 10px",
                  fontFamily: "Inter, system-ui, Arial",
                }}
              />
              <Typography variant="caption" color="text.secondary">
                If empty, repeats are generated for ~30 days.
              </Typography>
            </Box>
          )}

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "1fr 1fr" }}>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((s) => ({ ...s, startTime: e.target.value }))}
              style={{
                height: 40,
                borderRadius: 10,
                border: "1px solid #E2E8F0",
                padding: "0 10px",
                fontFamily: "Inter, system-ui, Arial",
              }}
            />
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((s) => ({ ...s, endTime: e.target.value }))}
              style={{
                height: 40,
                borderRadius: 10,
                border: "1px solid #E2E8F0",
                padding: "0 10px",
                fontFamily: "Inter, system-ui, Arial",
              }}
            />
          </Box>

          <input
            placeholder="Event title"
            value={form.title}
            onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
            style={{
              height: 40,
              borderRadius: 10,
              border: "1px solid #E2E8F0",
              padding: "0 10px",
              fontFamily: "Inter, system-ui, Arial",
            }}
          />

          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            rows={3}
            style={{
              borderRadius: 10,
              border: "1px solid #E2E8F0",
              padding: "10px",
              fontFamily: "Inter, system-ui, Arial",
              resize: "vertical",
            }}
          />

          {/* Staff assignment */}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: "text.secondary" }}>
                Assign Staff
              </Typography>
              <Button
                size="small"
                variant={form.assignedStaff.length === allStaff.length ? "contained" : "outlined"}
                onClick={() =>
                  setForm((s) => ({
                    ...s,
                    assignedStaff: s.assignedStaff.length === allStaff.length
                      ? []
                      : allStaff.map((m) => m.id),
                  }))
                }
                sx={{ fontSize: 11, py: 0.3, textTransform: "none" }}
              >
                {form.assignedStaff.length === allStaff.length ? "Deselect All" : "Assign All"}
              </Button>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxHeight: 160, overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: 2, p: 1 }}>
              {allStaff.map((s) => {
                const checked = form.assignedStaff.includes(s.id);
                return (
                  <FormControlLabel
                    key={s.id}
                    control={
                      <Checkbox
                        size="small"
                        checked={checked}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            assignedStaff: checked
                              ? prev.assignedStaff.filter((id) => id !== s.id)
                              : [...prev.assignedStaff, s.id],
                          }))
                        }
                      />
                    }
                    label={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.role}</Typography>
                      </Box>
                    }
                  />
                );
              })}
            </Box>
            {form.assignedStaff.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                {form.assignedStaff.length} staff member{form.assignedStaff.length > 1 ? "s" : ""} assigned
              </Typography>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEvent}>
            Save
          </Button>
        </DialogActions>
      </GemDialog>

      {/* EVENT DETAILS */}
      <GemDialog open={openDetails} onClose={() => setOpenDetails(false)} fullWidth maxWidth="sm">
        <DialogTitle>Event Details</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {!selectedEvent ? null : (
            <Box sx={{ display: "grid", gap: 1.2 }}>
              <Typography sx={{ fontWeight: 950, fontSize: 18 }}>
                {selectedEvent.title}
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Date: <b>{ymd(selectedEvent.start)}</b>
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Time:{" "}
                <b>
                  {format(selectedEvent.start, "HH:mm")} - {format(selectedEvent.end, "HH:mm")}
                </b>
              </Typography>

              <Typography variant="body2" color="text.secondary">
                {repeatLabel(selectedEvent)}
              </Typography>

              {selectedEvent.repeatUntil ? (
                <Typography variant="body2" color="text.secondary">
                  Repeat until: <b>{ymd(new Date(selectedEvent.repeatUntil))}</b>
                </Typography>
              ) : null}

              {selectedEvent.description ? (
                <>
                  <Divider />
                  <Typography variant="body2">{selectedEvent.description}</Typography>
                </>
              ) : null}

              {selectedEvent.assignedStaff?.length > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>Assigned Staff</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                      {selectedEvent.assignedStaff.map((id) => {
                        const s = allStaff.find((m) => m.id === id);
                        return s ? (
                          <Chip key={id} label={`${s.name} · ${s.role}`} size="small" sx={{ fontSize: 11 }} />
                        ) : null;
                      })}
                    </Box>
                  </Box>
                </>
              )}

              <Divider />
              <Typography variant="caption" color="text.secondary">
                Tip: If this event repeats, you can delete just this occurrence or the whole series.
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
          <Button onClick={() => setOpenDetails(false)}>Close</Button>

          <Box sx={{ display: "flex", gap: 1 }}>
            {selectedEvent?.seriesId ? (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => deleteSeries(selectedEvent.seriesId)}
              >
                Delete Series
              </Button>
            ) : null}

            {selectedEvent?.id ? (
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => deleteOneOccurrence(selectedEvent.id)}
              >
                Delete
              </Button>
            ) : null}
          </Box>
        </DialogActions>
      </GemDialog>
    </GemCard>
  );
}
