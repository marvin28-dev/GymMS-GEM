import { ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import { NavLink } from "react-router-dom";

export default function NavItem({ to, icon, label }) {
  return (
    <ListItemButton
      component={NavLink}
      to={to}
      sx={{
        mx: 1,
        my: 0.5,
        borderRadius: 999,
        gap: 1.2,

        "& .MuiListItemIcon-root": {
          minWidth: 36,
          color: "text.secondary",
        },

        "& .MuiListItemText-primary": {
          fontWeight: 800,
          color: "text.primary",
        },

        // ✅ active state
        "&.active": {
          backgroundColor: "primary.main",
          boxShadow: "0 10px 22px rgba(67, 56, 202, 0.25)",
        },
        "&.active .MuiListItemIcon-root": {
          color: "#fff",
        },
        "&.active .MuiListItemText-primary": {
          color: "#fff",
          fontWeight: 900,
        },

        // hover
        "&:hover": {
          backgroundColor: "rgba(67, 56, 202, 0.08)",
        },
        "&.active:hover": {
          backgroundColor: "primary.main",
        },
      }}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={label} />
    </ListItemButton>
  );
}
