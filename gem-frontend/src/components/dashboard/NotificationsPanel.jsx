import { Box, Divider, Tab, Tabs, Typography } from "@mui/material";
import GemCard from "../ui/GemCard";

export default function NotificationsPanel({ notifications = [] }) {
  const unread = notifications; // mock: all unread for now

  return (
    <GemCard sx={{ height: "100%" }} contentSx={{ p: 0, height: "100%" }}>
      <Box sx={{ p: 2 }}>
        <Typography sx={{ fontWeight: 900 }}>Notifications</Typography>
      </Box>
      <Divider />

      <Tabs value={0} sx={{ px: 1 }}>
        <Tab label="Unread" />
      </Tabs>

      {/* body stretches */}
      <Box sx={{ p: 2, height: "calc(100% - 108px)" }}>
        {unread.length === 0 ? (
          <Box sx={{ height: "100%", display: "grid", placeItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              0 Notifications
            </Typography>
          </Box>
        ) : (
          unread.map((n) => (
            <Box key={n.id} sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 1 }}>
              <Typography sx={{ fontWeight: 800 }}>{n.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {n.body}
              </Typography>
            </Box>
          ))
        )}
      </Box>
    </GemCard>
  );
}
