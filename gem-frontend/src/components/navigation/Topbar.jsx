import { AppBar, Box, IconButton, Toolbar, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

export default function Topbar({ onMenu }) {
  return (
    <AppBar position="fixed" color="inherit" elevation={0} sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
      <Toolbar>
        <IconButton edge="start" onClick={onMenu} aria-label="open menu">
          <MenuIcon />
        </IconButton>

        <Box sx={{ ml: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
            GEM
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Gym Elite Management
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
