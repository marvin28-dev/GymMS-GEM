import React from "react";
import { Dialog } from "@mui/material";

export default function GemDialog({ maxWidth = "sm", PaperProps, children, ...props }) {
  return (
    <Dialog
      {...props}
      fullWidth
      maxWidth={maxWidth}
      scroll="paper"
      sx={{
        "& .MuiDialog-container": {
          alignItems: "center",
          padding: { xs: 2, sm: 3 }, // safe spacing around the dialog
        },

        "& .MuiDialog-paper": {
          margin: 0,
          width: "100%",
          borderRadius: 5,
          overflow: "hidden",
          maxHeight: "calc(100dvh - 48px)", // mobile-safe viewport height
          height: "auto",
          display: "flex",
          flexDirection: "column",
        },

        // ✅ key: do NOT add big paddingTop here, only avoid clipping
        "& .MuiDialogContent-root": {
          overflow: "visible",
          paddingTop: 0,
        },
      }}
      PaperProps={{
        ...PaperProps,
        sx: {
          ...(PaperProps?.sx || {}),
        },
      }}
    >
      {/* ✅ Keep your nice spacing + rounded look */}
      <div style={{ padding: "32px 24px 24px" }}>{children}</div>
    </Dialog>
  );
}
