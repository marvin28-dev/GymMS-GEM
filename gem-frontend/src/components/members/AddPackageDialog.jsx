import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import GemDialog from "../ui/GemDialog";
import GemTextField from "../ui/GemTextField";

const ACCESS_OPTIONS = ["Gym", "Cardio", "Musculation"];

function FieldBlock({ title, children }) {
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Typography sx={{ fontWeight: 950, fontSize: 13 }} color="text.secondary">
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function AddPackageDialog({ open, mode = "create", initial, onClose, onSave }) {
  const isEdit = mode === "edit";

  const [title, setTitle] = useState("");
  const [access, setAccess] = useState(["Gym"]);
  const [price, setPrice] = useState("");
  const [enrolledCount, setEnrolledCount] = useState("");

  useEffect(() => {
    if (!open) return;

    if (isEdit && initial) {
      setTitle(initial.title || "");
      setAccess(Array.isArray(initial.access) ? initial.access : ["Gym"]);
      setPrice(String(initial.price ?? ""));
      setEnrolledCount(String(initial.enrolledCount ?? ""));
    } else {
      setTitle("");
      setAccess(["Gym"]);
      setPrice("");
      setEnrolledCount("");
    }
  }, [open, isEdit, initial]);

  const canSave = useMemo(() => {
    const p = Number(price);
    return title.trim().length > 0 && Array.isArray(access) && access.length > 0 && !Number.isNaN(p) && p > 0;
  }, [title, access, price]);

  const handleSave = () => {
    if (!canSave) return;
    onSave?.({
      title: title.trim(),
      access,
      price: Number(price),
      enrolledCount: Number(enrolledCount || 0),
    });
  };

  return (
    <GemDialog open={open} onClose={onClose} maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 950 }}>
        {isEdit ? "Edit Package" : "Add New Package"}
      </DialogTitle>

      {/* ✅ keep your “no clipping” approach */}
      <DialogContent>
        <Box sx={{ pt: 1, display: "grid", gap: 2 }}>
          <FieldBlock title="Title">
            <GemTextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Elite VIP" />
          </FieldBlock>

          <FieldBlock title="Access">
            <ToggleButtonGroup
              value={access}
              onChange={(_, v) => setAccess(v)}
              aria-label="access"
              size="small"
              sx={{
                flexWrap: "wrap",
                gap: 1,
                "& .MuiToggleButton-root": {
                  borderRadius: 999,
                  fontWeight: 950,
                  px: 2,
                  borderColor: "divider",
                },
              }}
            >
              {ACCESS_OPTIONS.map((a) => (
                <ToggleButton key={a} value={a}>
                  {a}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </FieldBlock>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <FieldBlock title="Price (XAF)">
              <GemTextField
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="25000"
              />
            </FieldBlock>

            <FieldBlock title="Enrolled Members">
              <GemTextField
                type="number"
                value={enrolledCount}
                onChange={(e) => setEnrolledCount(e.target.value)}
                placeholder="0"
              />
            </FieldBlock>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="text" sx={{ fontWeight: 950 }}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave} variant="contained" sx={{ fontWeight: 950 }}>
          Save
        </Button>
      </DialogActions>
    </GemDialog>
  );
}

export default AddPackageDialog;