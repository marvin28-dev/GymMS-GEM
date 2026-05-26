import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Divider, InputAdornment, MenuItem, Select, Typography } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

import GemCard from "../components/ui/GemCard";
import GemTextField from "../components/ui/GemTextField";

const STAFF_LS_KEY = "gem_staff_v1";
const FRONTDESK_SESSION_KEY = "gem_frontdesk_session_v1";

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

export default function FrontDeskLogin() {
  const navigate = useNavigate();

  const [staff, setStaff] = useState([]);
  const [staffId, setStaffId] = useState("");
  const [search, setSearch] = useState("");
  const [pin, setPin] = useState("");

  useEffect(() => {
    const s = getJSON(STAFF_LS_KEY, []);
    setStaff(Array.isArray(s) ? s : []);
  }, []);

  const staffFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((x) => String(x.name || "").toLowerCase().includes(q));
  }, [staff, search]);

  const selectedStaff = useMemo(() => staff.find((x) => x.id === staffId), [staff, staffId]);

  const canLogin = Boolean(selectedStaff) && pin.trim().length >= 3;

  const login = () => {
    if (!canLogin) return;

    setJSON(FRONTDESK_SESSION_KEY, {
      staffId: selectedStaff.id,
      staffName: selectedStaff.name,
      loggedInAt: new Date().toISOString(),
    });

    navigate("/front-desk/mode");
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography sx={{ fontWeight: 950, fontSize: 24 }}>Front Desk</Typography>
        <Typography color="text.secondary" sx={{ fontWeight: 800 }}>
          Login to enter Front Desk Mode
        </Typography>
      </Box>

      <GemCard contentSx={{ p: 2.2 }}>
        <Typography sx={{ fontWeight: 950, mb: 1 }}>Front Desk Login</Typography>
        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: "grid", gap: 2, maxWidth: 520 }}>
          <GemTextField
            placeholder="Search staff name"
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

          <Select
            size="small"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            displayEmpty
            sx={{ fontWeight: 900, borderRadius: 3 }}
          >
            <MenuItem value="">
              <span style={{ fontWeight: 900, opacity: 0.7 }}>Select staff</span>
            </MenuItem>
            {staffFiltered.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </Select>

          <GemTextField
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputProps={{ inputMode: "numeric" }}
          />

          <Box sx={{ display: "flex", gap: 1.2 }}>
            <Button variant="outlined" sx={{ fontWeight: 900, borderRadius: 3 }} onClick={() => navigate("/dashboard")}>
              Cancel
            </Button>
            <Button
              variant="contained"
              sx={{ fontWeight: 950, borderRadius: 3 }}
              disabled={!canLogin}
              onClick={login}
            >
              Enter Front Desk Mode
            </Button>
          </Box>
        </Box>
      </GemCard>
    </Box>
  );
}
