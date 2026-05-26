// src/components/products/AddCategoryDialog.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  TextField,
  Typography,
  Box,
} from "@mui/material";
import GemDialog from "../ui/GemDialog";

const TYPE_OPTIONS = ["Liquid", "Clothes", "Food", "Other"];

export default function AddCategoryDialog({
  open,
  mode = "create", // create | edit
  initial,
  onClose,
  onSave,
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Liquid");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && initial) {
      setName(initial.name || "");
      setType(initial.type || "Liquid");
      setDescription(initial.description || "");
      return;
    }

    setName("");
    setType("Liquid");
    setDescription("");
  }, [open, mode, initial]);

  const canSave = useMemo(() => String(name).trim().length > 0, [name]);

  return (
    <GemDialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 950 }}>
        {mode === "edit" ? "Edit Category" : "Add a New Category"}
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, display: "grid", gap: 2 }}>
        {/* Name */}
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontWeight: 950, fontSize: 13 }} color="text.secondary">
            Name
          </Typography>
          <TextField
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Drinks"
          />
        </Box>

        {/* Type */}
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontWeight: 950, fontSize: 13 }} color="text.secondary">
            Type
          </Typography>
          <FormControl fullWidth size="small">
            <Select value={type} onChange={(e) => setType(e.target.value)} sx={{ fontWeight: 900 }}>
              {TYPE_OPTIONS.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Description */}
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography sx={{ fontWeight: 950, fontSize: 13 }} color="text.secondary">
            Description
          </Typography>
          <TextField
            multiline
            minRows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this category..."
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ fontWeight: 900 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canSave}
          onClick={() =>
            onSave?.({
              name: String(name).trim(),
              type,
              description: String(description).trim(),
              // keep old stockQty if you still use it elsewhere, otherwise omit
              stockQty: initial?.stockQty ?? 0,
            })
          }
          sx={{ fontWeight: 950 }}
        >
          Save
        </Button>
      </DialogActions>
    </GemDialog>
  );
}
