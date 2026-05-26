import { Box, Divider, List, Typography, Avatar, Button } from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import GroupsIcon from "@mui/icons-material/Groups";
import PublicIcon from "@mui/icons-material/Public";
import StorefrontIcon from "@mui/icons-material/Storefront";
import BadgeIcon from "@mui/icons-material/Badge";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import FrontHandIcon from "@mui/icons-material/FrontHand";
import NotificationsIcon from "@mui/icons-material/Notifications";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

import { useState, useEffect } from "react";
import NavItem from "./NavItem";
import { getMyGym } from "../../services/gym.service";

export default function Sidebar() {
  const [gym, setGym] = useState({ name: 'GEM', location: '' });

  useEffect(() => {
    getMyGym().then(res => { if (res.data) setGym(res.data); }).catch(() => {});
  }, []);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ bgcolor: "primary.main" }}>
          <FitnessCenterIcon />
        </Avatar>
        <Box>
          <Typography sx={{ fontWeight: 900, lineHeight: 1.1 }}>{(gym.name || 'GEM').toUpperCase()}</Typography>
          <Typography variant="caption" color="text.secondary">
            {gym.location || ''}
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box sx={{ p: 1, flex: 1, overflow: "auto" }}>
        <List disablePadding>
          <NavItem to="/dashboard" icon={<DashboardIcon />} label="Dashboard" />
          <NavItem to="/members" icon={<GroupsIcon />} label="Members" />
          <NavItem to="/website" icon={<PublicIcon />} label="Website" />
          <NavItem to="/products" icon={<StorefrontIcon />} label="Products" />
          <NavItem to="/staff" icon={<BadgeIcon />} label="Staff" />
          <NavItem to="/accounting" icon={<AccountBalanceIcon />} label="Reports" />
          <NavItem to="/front-desk" icon={<FrontHandIcon />} label="Front Desk" />
          <NavItem to="/notifications" icon={<NotificationsIcon />} label="Notification" />
          <NavItem to="/gym-profile" icon={<FitnessCenterIcon />} label="Gym Profile" />
          <NavItem to="/help" icon={<HelpOutlineIcon />} label="Help" />
        </List>
      </Box>

      <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Button fullWidth variant="outlined" startIcon={<SwapHorizIcon />}>
          Switch Gym
        </Button>
      </Box>
    </Box>
  );
}
