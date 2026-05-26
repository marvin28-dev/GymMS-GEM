import { createTheme, alpha } from "@mui/material/styles";

const primary = "#4338CA";     // mature indigo (official GEM brand)
const slate900 = "#0F172A";
const slate700 = "#334155";
const slate600 = "#475569";
const slate500 = "#64748B";
const slate200 = "#E2E8F0";
const slate100 = "#F1F5F9";
const bg = "#F8FAFC";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: primary },
    background: {
      default: bg,
      paper: "#FFFFFF",
    },
    text: {
      primary: slate900,
      secondary: slate600,
    },
    divider: slate200,
  },

  typography: {
    fontFamily: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial"].join(","),
    h5: { fontWeight: 900, letterSpacing: -0.6, color: slate900 },
    h6: { fontWeight: 850, letterSpacing: -0.4, color: slate900 },
    subtitle1: { fontWeight: 700, color: slate700 },
    subtitle2: { fontWeight: 700, color: slate700 },
    body1: { color: slate700 },
    body2: { color: slate600 },
    caption: { color: slate500 },
    button: { fontWeight: 800, textTransform: "none", letterSpacing: 0 },
  },

  shape: { borderRadius: 16 },

  shadows: [
    "none",
    "0 1px 2px rgba(15, 23, 42, 0.06)",
    "0 4px 14px rgba(15, 23, 42, 0.08)",
    "0 8px 24px rgba(15, 23, 42, 0.10)",
    ...Array(21).fill("0 10px 30px rgba(15, 23, 42, 0.10)"),
  ],

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: bg,
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: `1px solid ${alpha(slate200, 1)}`,
          boxShadow: "0 2px 18px rgba(15, 23, 42, 0.06)",
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          paddingInline: 14,
          height: 40,
        },
        contained: {
          boxShadow: "0 10px 22px rgba(67, 56, 202, 0.18)",
        },
        outlined: {
          borderColor: alpha(primary, 0.25),
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: "#fff",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha(slate200, 1),
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha(primary, 0.35),
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: primary,
            borderWidth: 1,
          },
        },
        input: {
          paddingTop: 10,
          paddingBottom: 10,
        },
      },
    },

    MuiSelect: {
      styleOverrides: {
        select: {
          paddingTop: 10,
          paddingBottom: 10,
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          color: slate700,
          fontWeight: 900,
          backgroundColor: slate100,
          borderBottom: `1px solid ${slate200}`,
        },
        body: {
          borderBottom: `1px solid ${slate200}`,
        },
      },
    },

    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 999,
        },
      },
    },

    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 800,
          minHeight: 44,
        },
      },
    },

    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 900,
        },
      },
    },
  },
});

export default theme;
