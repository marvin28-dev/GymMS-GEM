import { Box, Typography } from "@mui/material";
import GemCard from "../components/ui/GemCard";

export default function Placeholder({ title }) {
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Wireframe pending — upload it and I’ll build this module.
        </Typography>
      </Box>

      <GemCard>
        <Typography sx={{ fontWeight: 800 }}>Waiting for wireframe</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          As soon as you upload the screen, I’ll map route/components/interactions and generate the full UI.
        </Typography>
      </GemCard>
    </Box>
  );
}
