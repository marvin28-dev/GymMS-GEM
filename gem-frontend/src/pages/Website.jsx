import React, { useState } from "react";
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import GemCard from "../components/ui/GemCard";
import GemDialog from "../components/ui/GemDialog";
import GemTextField from "../components/ui/GemTextField";

const LS_WEBSITE_KEY = "gem_website_settings_v1";

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

export default function Website() {
  const stored = getJSON(LS_WEBSITE_KEY, null);

  const [websiteUrl] = useState(stored?.url || "https://elitefitnessclub.example");
  const [openReq, setOpenReq] = useState(false);

  // Request form
  const [type, setType] = useState("Content Update");
  const [priority, setPriority] = useState("Normal");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  const canSubmit = title.trim().length > 0 && details.trim().length > 0;

  const handleGoToWebsite = () => {
    // Replace with your real URL later
    window.open(websiteUrl, "_blank", "noopener,noreferrer");
  };

  const handleSubmit = () => {
    if (!canSubmit) return;

    // Stub storage for now (backend later)
    const payload = {
      id: `webreq_${Date.now()}`,
      createdAt: new Date().toISOString(),
      type,
      priority,
      title: title.trim(),
      details: details.trim(),
      status: "Submitted",
    };

    const existing = getJSON("gem_website_requests_v1", []);
    setJSON("gem_website_requests_v1", [payload, ...(existing || [])]);

    setOpenReq(false);
    setTitle("");
    setDetails("");
    setType("Content Update");
    setPriority("Normal");
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      {/* Page header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 950 }}>
            Website
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View or make changes to your website here
          </Typography>
        </Box>
      </Box>

      <GemCard contentSx={{ p: { xs: 2, sm: 3 } }}>
        {/* Center actions like wireframe */}
        <Box
          sx={{
            minHeight: { xs: 320, sm: 420 },
            display: "grid",
            placeItems: "center",
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 3,
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="contained"
              startIcon={<OpenInNewRoundedIcon />}
              onClick={handleGoToWebsite}
              sx={{
                fontWeight: 950,
                px: 4,
                py: 1.25,
                borderRadius: 2.5,
                boxShadow: "0 10px 24px rgba(2,6,23,0.12)",
              }}
            >
              Go to Website
            </Button>

            <Button
              variant="outlined"
              startIcon={<EditRoundedIcon />}
              onClick={() => setOpenReq(true)}
              sx={{
                fontWeight: 950,
                px: 4,
                py: 1.25,
                borderRadius: 2.5,
              }}
            >
              Request Changes
            </Button>
          </Box>
        </Box>
      </GemCard>

      {/* Request Changes dialog */}
      <GemDialog open={openReq} onClose={() => setOpenReq(false)} maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 950 }}>Request Website Changes</DialogTitle>

        <DialogContent sx={{ pt: 2.5, display: "grid", gap: 2 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <Box sx={{ display: "grid", gap: 0.75 }}>
              <Typography sx={{ fontWeight: 950, fontSize: 12.5 }} color="text.secondary">
                Change Type
              </Typography>
              <FormControl fullWidth size="small">
                <Select value={type} onChange={(e) => setType(e.target.value)} sx={{ fontWeight: 900 }}>
                  <MenuItem value="Content Update">Content Update</MenuItem>
                  <MenuItem value="Design Update">Design Update</MenuItem>
                  <MenuItem value="Bug Fix">Bug Fix</MenuItem>
                  <MenuItem value="New Section">New Section</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: "grid", gap: 0.75 }}>
              <Typography sx={{ fontWeight: 950, fontSize: 12.5 }} color="text.secondary">
                Priority
              </Typography>
              <FormControl fullWidth size="small">
                <Select value={priority} onChange={(e) => setPriority(e.target.value)} sx={{ fontWeight: 900 }}>
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Normal">Normal</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Box sx={{ display: "grid", gap: 0.75 }}>
            <Typography sx={{ fontWeight: 950, fontSize: 12.5 }} color="text.secondary">
              Title
            </Typography>
            <GemTextField
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Update pricing section"'
            />
          </Box>

          <Box sx={{ display: "grid", gap: 0.75 }}>
            <Typography sx={{ fontWeight: 950, fontSize: 12.5 }} color="text.secondary">
              Details
            </Typography>
            <GemTextField
              multiline
              minRows={5}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what you want changed..."
              sx={{
                "& .MuiOutlinedInput-root": { alignItems: "flex-start" },
                "& textarea": { paddingTop: 10 },
              }}
            />
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
            (For now this saves to localStorage. Backend workflow comes later.)
          </Typography>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenReq(false)} sx={{ fontWeight: 950 }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!canSubmit} sx={{ fontWeight: 950 }}>
            Submit
          </Button>
        </DialogActions>
      </GemDialog>
    </Box>
  );
}
