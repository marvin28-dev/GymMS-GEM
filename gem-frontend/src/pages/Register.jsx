import { Box, Button, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import GemCard from "../components/ui/GemCard";

export default function Register() {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2, bgcolor: "background.default" }}>
      <GemCard sx={{ width: "100%", maxWidth: 640 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Create Account
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Placeholder screen — we’ll build this when you upload the register wireframe.
        </Typography>

        <Button component={RouterLink} to="/login" sx={{ mt: 2 }} variant="outlined">
          Back to Login
        </Button>
      </GemCard>
    </Box>
  );
}
