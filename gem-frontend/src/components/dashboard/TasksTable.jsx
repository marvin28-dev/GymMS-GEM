import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
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
  Chip,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { alpha, useTheme } from "@mui/material/styles";

import GemCard from "../ui/GemCard";
import GemDialog from "../ui/GemDialog";

const LS_KEY = "gem_tasks_v2";
const DONE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LabeledField = ({ label, children }) => (
  <Box sx={{ display: "grid", gap: 0.7 }}>
    <Typography variant="caption" sx={{ fontWeight: 900, color: "text.secondary" }}>
      {label}
    </Typography>
    {children}
  </Box>
);


const MOCK_STAFF = [
  { id: "me", name: "Myself — Owner" },
  { id: "stephen", name: "Stephen — Manager" },
  { id: "amina", name: "Amina — Front Desk" },
  { id: "sam", name: "Sam — Coach" },
];

function nowISODate() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString();
  } catch {
    return iso;
  }
}
function createId() {
  return (crypto?.randomUUID?.() || `t_${Date.now()}_${Math.random().toString(16).slice(2)}`);
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(LS_KEY, JSON.stringify(tasks));
}

function cleanupDoneExpired(tasks) {
  const now = Date.now();
  const next = tasks.filter((t) => {
    if (t.status !== "done") return true;
    if (!t.doneAt) return true; // if somehow missing, keep (or you can delete)
    return now - t.doneAt < DONE_TTL_MS;
  });
  return next;
}

export default function TasksTable() {
  const theme = useTheme();

  // ✅ Start with empty by default (user adds tasks)
  const [tasks, setTasks] = useState(() => cleanupDoneExpired(loadTasks()));

  // dialogs
  const [openAdd, setOpenAdd] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const [selectedTask, setSelectedTask] = useState(null);

  // row menu
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuTask, setMenuTask] = useState(null);

  // form
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    assignToId: "me",
  });

  // ✅ auto-cleanup done tasks (every minute) + also on mount
  useEffect(() => {
    const tick = () => {
      setTasks((prev) => {
        const cleaned = cleanupDoneExpired(prev);
        if (cleaned.length !== prev.length) saveTasks(cleaned);
        return cleaned;
      });
    };

    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // persist whenever tasks change
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const actionsNeeded = useMemo(
    () => tasks.filter((t) => t.status !== "done").length,
    [tasks]
  );

  const openRowMenu = (evt, task) => {
    evt.stopPropagation();
    setMenuAnchor(evt.currentTarget);
    setMenuTask(task);
  };

  const closeRowMenu = () => {
    setMenuAnchor(null);
    setMenuTask(null);
  };

  const handleOpenView = (task) => {
    setSelectedTask(task);
    setOpenView(true);
  };

  const handleOpenEdit = (task) => {
    setSelectedTask(task);
    setForm({
      title: task.title || "",
      description: task.description || "",
      dueDate: task.dueDate || "",
      assignToId: task.assignToId || "me",
    });
    setOpenEdit(true);
  };

  const handleOpenAdd = () => {
    setSelectedTask(null);
    setForm({
      title: "",
      description: "",
      dueDate: "",
      assignToId: "me",
    });
    setOpenAdd(true);
  };

  const upsertTask = (mode) => {
    if (!form.title.trim()) return;

    const staff = MOCK_STAFF.find((s) => s.id === form.assignToId) || MOCK_STAFF[0];
    const payload = {
      title: form.title.trim(),
      description: form.description?.trim() || "",
      dueDate: form.dueDate || "",
      assignToId: staff.id,
      assignToName: staff.name,
    };

    if (mode === "add") {
      const next = [
        {
          id: createId(),
          ...payload,
          createdOn: nowISODate(),
          status: "open",
          doneAt: null,
        },
        ...tasks,
      ];
      setTasks(next);
      setOpenAdd(false);
      return;
    }

    if (mode === "edit" && selectedTask?.id) {
      const next = tasks.map((t) => (t.id === selectedTask.id ? { ...t, ...payload } : t));
      setTasks(next);
      setOpenEdit(false);
      setSelectedTask(null);
    }
  };

  const markDone = (taskId) => {
    const next = tasks.map((t) =>
      t.id === taskId ? { ...t, status: "done", doneAt: Date.now() } : t
    );
    setTasks(next);

    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, status: "done", doneAt: Date.now() } : prev));
    }
  };

  const statusChip = (status) => {
    if (status === "done") {
      return (
        <Chip
          size="small"
          icon={<CheckCircleIcon />}
          label="Done"
          sx={{
            fontWeight: 800,
            bgcolor: alpha(theme.palette.success.main, 0.12),
            color: theme.palette.success.dark,
          }}
        />
      );
    }
    return (
      <Chip
        size="small"
        label="Open"
        sx={{
          fontWeight: 800,
          bgcolor: alpha(theme.palette.primary.main, 0.10),
          color: theme.palette.primary.main,
        }}
      />
    );
  };



  return (
    <GemCard contentSx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography sx={{ fontWeight: 950, fontSize: 16 }}>
          My Tasks ({actionsNeeded} actions needed)
        </Typography>

        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleOpenAdd} sx={{ fontWeight: 900 }}>
          Add Task
        </Button>
      </Box>

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Assign To</TableCell>
              <TableCell>Created On</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {tasks.map((t) => (
              <TableRow
                key={t.id}
                hover
                onClick={() => handleOpenView(t)}
                sx={{
                  cursor: "pointer",
                  "& td": { borderBottom: "1px solid", borderColor: "divider" }, // ✅ lines between tasks
                }}
              >
                <TableCell sx={{ fontWeight: 800 }}>{t.title}</TableCell>
                <TableCell>{fmtDate(t.dueDate)}</TableCell>
                <TableCell>{t.assignToName || "-"}</TableCell>
                <TableCell>{fmtDate(t.createdOn)}</TableCell>
                <TableCell>{statusChip(t.status)}</TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <IconButton size="small" onClick={(e) => openRowMenu(e, t)}>
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}

            {/* ✅ Empty state: no tasks initially */}
            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Box
                    sx={{
                      py: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                    }}
                  >
                    <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                      No tasks yet, click on the Add Task button to add a task
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}

          </TableBody>
        </Table>
      </TableContainer>

      {/* Actions Menu: ONLY View / Edit / Mark as done */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeRowMenu}>
        <MenuItem
          onClick={() => {
            if (menuTask) handleOpenView(menuTask);
            closeRowMenu();
          }}
        >
          View
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (menuTask) handleOpenEdit(menuTask);
            closeRowMenu();
          }}
        >
          Edit
        </MenuItem>

        <Divider />

        <MenuItem
          disabled={menuTask?.status === "done"}
          onClick={() => {
            if (menuTask) markDone(menuTask.id);
            closeRowMenu();
          }}
          sx={{ fontWeight: 900 }}
        >
          Mark as done
        </MenuItem>
      </Menu>

      {/* VIEW */}
      <GemDialog open={openView} onClose={() => setOpenView(false)} fullWidth maxWidth="sm">
        <DialogTitle>Task Details</DialogTitle>
        <DialogContent sx={{ pt: 2.5, display: "grid", gap: 2 }}>
          <Box sx={{ display: "grid", gap: 0.7 }}>
            <Typography variant="caption" sx={{ fontWeight: 900, color: "text.secondary" }}>
              Title
            </Typography>
            <TextField
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              placeholder="Enter task title"
              fullWidth
              size="small"
            />
          </Box>

          <Box sx={{ display: "grid", gap: 0.7 }}>
            <Typography variant="caption" sx={{ fontWeight: 900, color: "text.secondary" }}>
              Description
            </Typography>
            <TextField
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              placeholder="Add details (optional)"
              fullWidth
              multiline
              minRows={4}
              size="small"
            />
          </Box>

          <Box sx={{ display: "grid", gap: 0.7 }}>
            <Typography variant="caption" sx={{ fontWeight: 900, color: "text.secondary" }}>
              Due Date
            </Typography>
            <TextField
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))}
              fullWidth
              size="small"
            />
          </Box>

          <FormControl fullWidth size="small">
            <InputLabel id="assign-label">Assign to</InputLabel>
            <Select
              labelId="assign-label"
              label="Assign to"
              value={form.assignToId}
              onChange={(e) => setForm((s) => ({ ...s, assignToId: e.target.value }))}
            >
              {MOCK_STAFF.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>


        <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
          <Button onClick={() => setOpenView(false)}>Close</Button>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => {
                if (selectedTask) handleOpenEdit(selectedTask);
                setOpenView(false);
              }}
            >
              Edit
            </Button>

            <Button
              variant="contained"
              disabled={selectedTask?.status === "done"}
              onClick={() => {
                if (selectedTask) markDone(selectedTask.id);
                setOpenView(false);
              }}
            >
              Mark as done
            </Button>
          </Box>
        </DialogActions>
      </GemDialog>

      {/* ADD */}
      <GemDialog open={openAdd} onClose={() => setOpenAdd(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Task</DialogTitle>

        <DialogContent sx={{ pt: 2.5, display: "grid", gap: 2 }}>
          <LabeledField label="Title">
            <TextField
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              placeholder="Enter task title"
              fullWidth
              size="small"
            />
          </LabeledField>

          <LabeledField label="Description">
            <TextField
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              placeholder="Add details (optional)"
              fullWidth
              multiline
              minRows={4}
              size="small"
            />
          </LabeledField>

          <LabeledField label="Due Date">
            <TextField
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))}
              fullWidth
              size="small"
            />
          </LabeledField>

          <FormControl fullWidth size="small">
            <InputLabel id="assign-label">Assign to</InputLabel>
            <Select
              labelId="assign-label"
              label="Assign to"
              value={form.assignToId}
              onChange={(e) => setForm((s) => ({ ...s, assignToId: e.target.value }))}
            >
              {MOCK_STAFF.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAdd(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => upsertTask("add")}>
            Save
          </Button>
        </DialogActions>
      </GemDialog>

      {/* EDIT */}
      <GemDialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Task</DialogTitle>

        <DialogContent sx={{ pt: 2.5, display: "grid", gap: 2 }}>
          <LabeledField label="Title">
            <TextField
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              placeholder="Enter task title"
              fullWidth
              size="small"
            />
          </LabeledField>

          <LabeledField label="Description">
            <TextField
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              placeholder="Add details (optional)"
              fullWidth
              multiline
              minRows={4}
              size="small"
            />
          </LabeledField>

          <LabeledField label="Due Date">
            <TextField
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))}
              fullWidth
              size="small"
            />
          </LabeledField>

          <FormControl fullWidth size="small">
            <InputLabel id="assign-edit-label">Assign to</InputLabel>
            <Select
              labelId="assign-edit-label"
              label="Assign to"
              value={form.assignToId}
              onChange={(e) => setForm((s) => ({ ...s, assignToId: e.target.value }))}
            >
              {MOCK_STAFF.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenEdit(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => upsertTask("edit")}>
            Save Changes
          </Button>
        </DialogActions>
      </GemDialog>
    </GemCard>
  );
}
