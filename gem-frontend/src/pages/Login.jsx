import { Box, Button, Checkbox, FormControlLabel, Paper, Typography } from "@mui/material";
import GemTextField from "../components/ui/GemTextField";
import { useState } from "react";
import { setAuth } from "../utils/auth";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    gymId: "",
    username: "",
    password: "",
    remember: true,
  });

  function onSubmit(e) {
    e.preventDefault();

    // mock auth (backend later)
    setAuth({
      gymId: form.gymId || "elite-fitness-club",
      username: form.username || "manager",
      remember: form.remember,
      role: "manager",
      createdAt: Date.now(),
    });

    nav("/dashboard");
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", gridTemplateColumns: { xs: "1fr", md: "420px 1fr" } }}>
      {/* Left branding panel */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          alignItems: "center",
          justifyContent: "center",
          p: 4,
          bgcolor: "background.paper",
          borderRight: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ textAlign: "center", maxWidth: 320 }}>
          <Box
            sx={{
              width: 90,
              height: 90,
              borderRadius: 4,
              bgcolor: "primary.main",
              display: "grid",
              placeItems: "center",
              mx: "auto",
              mb: 2,
            }}
          >
            <FitnessCenterIcon sx={{ color: "white", fontSize: 44 }} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            GEM
          </Typography>
          <Typography sx={{ fontWeight: 700, mt: 0.5 }}>GymElite Manager</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Streamline your gym operations with ease
          </Typography>
        </Box>
      </Box>

      {/* Right form panel */}
      <Box sx={{ p: { xs: 2, md: 4 }, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box sx={{ width: "100%", maxWidth: 520 }}>
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
            <Button component={RouterLink} to="/register" variant="outlined">
              Create Account
            </Button>
          </Box>

          <Paper sx={{ p: 3, borderRadius: 4, border: "1px solid", borderColor: "divider" }} elevation={0}>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              Login Into GEM
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
              login as the owner, manager, frontdesk using username or email
            </Typography>

            <Box component="form" onSubmit={onSubmit} sx={{ display: "grid", gap: 2 }}>
              <GemTextField
                label="Gym Url Or Unique ID"
                value={form.gymId}
                onChange={(e) => setForm((s) => ({ ...s, gymId: e.target.value }))}
              />
              <GemTextField
                label="username or email"
                value={form.username}
                onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
              />
              <GemTextField
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={form.remember}
                    onChange={(e) => setForm((s) => ({ ...s, remember: e.target.checked }))}
                  />
                }
                label="Remember me"
              />

              <Button type="submit" variant="contained" sx={{ height: 44 }}>
                LOGIN
              </Button>

              <Typography variant="caption" color="text.secondary">
                (Mock login for now. Backend/auth will replace this in Phase B.)
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
