import React from "react";
import { TextField } from "@mui/material";

export default function GemTextField(props) {
  const { sx, multiline, ...rest } = props;

  return (
    <TextField
      {...rest}
      fullWidth
      size="small"
      variant="outlined"
      multiline={multiline}
      sx={{
        "& .MuiOutlinedInput-root": {
          borderRadius: multiline ? 3 : 999,
          alignItems: multiline ? "flex-start" : "center",
        },

        // normal input padding
        "& .MuiOutlinedInput-input": {
          padding: "12px 14px",
        },

        // ✅ multiline textarea padding (this fixes the ugly cursor position)
        "& .MuiOutlinedInput-inputMultiline": {
          padding: "12px 14px",
          lineHeight: 1.5,
        },

        // optional: nicer textarea resize behavior
        "& textarea": {
          resize: "vertical",
        },

        ...sx,
      }}
    />
  );
}
