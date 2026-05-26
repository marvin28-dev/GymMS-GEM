import { Box, FormControl, MenuItem, Select, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import GemCard from "../ui/GemCard";

export default function KpiCard({ title, value, filter, onFilterChange }) {
  const theme = useTheme();

  return (
    <GemCard
      sx={{
        height: 140,
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(180deg,
          ${alpha(theme.palette.primary.main, 0.06)} 0%,
          ${alpha(theme.palette.background.paper, 1)} 60%)`,
        borderColor: alpha(theme.palette.primary.main, 0.14),
      }}
      contentSx={{ p: 2, height: "100%" }}
    >
      {/* subtle left accent bar */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: alpha(theme.palette.primary.main, 0.45),
        }}
      />

      {/* soft highlight */}
      <Box
        sx={{
          position: "absolute",
          top: -70,
          right: -70,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: alpha(theme.palette.primary.main, 0.10),
          filter: "blur(14px)",
          pointerEvents: "none",
        }}
      />

      {/* Title (mature slate tone) */}
      <Typography
        variant="body2"
        sx={{
          fontWeight: 800,
          lineHeight: 1.2,
          color: alpha(theme.palette.text.primary, 0.78), // ✅ softer than full black
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          pr: 2,
        }}
      >
        {title}
      </Typography>

      {/* Value (deep slate, not harsh) */}
      <Typography
        sx={{
          mt: 1,
          fontWeight: 900, // ✅ slightly less aggressive than 950
          fontSize: "clamp(28px, 3.2vw, 40px)",
          lineHeight: 1.05,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: alpha(theme.palette.text.primary, 0.92), // ✅ mature
          paddingBottom: "52px",
          letterSpacing: -0.4,
        }}
      >
        {value}
      </Typography>

      {/* Dropdown pinned bottom-right */}
      <Box sx={{ position: "absolute", right: 16, bottom: 12 }}>
        <FormControl size="small" sx={{ width: 165 }}>
          <Select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            sx={{
              borderRadius: 2,
              fontWeight: 800,
              fontSize: 12,
              color: alpha(theme.palette.text.primary, 0.80), // ✅ softer text
              bgcolor: alpha(theme.palette.background.paper, 0.92),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
              "& fieldset": { border: "none" },
              "& .MuiSelect-icon": {
                color: alpha(theme.palette.text.primary, 0.55),
              },
              "& .MuiSelect-select": {
                py: 0.7,
                pr: 4,
                whiteSpace: "nowrap",
              },
              "&:hover": {
                borderColor: alpha(theme.palette.primary.main, 0.30),
              },
            }}
          >
            <MenuItem value="mtd" sx={{ fontSize: 12 }}>
              Month-to-date
            </MenuItem>
            <MenuItem value="ytd" sx={{ fontSize: 12 }}>
              Year-to-date
            </MenuItem>
          </Select>
        </FormControl>
      </Box>
    </GemCard>
  );
}
