import React from "react";
import {
  Avatar,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

function initials(firstName, lastName) {
  const a = (firstName || "").trim()[0] || "";
  const b = (lastName || "").trim()[0] || "";
  return (a + b).toUpperCase() || "M";
}

function fmtDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function MembersTable({ rows = [], onRowClick }) {
  const theme = useTheme();

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 64 }} />
            <TableCell>Name</TableCell>
            <TableCell>Date-Joined</TableCell>
            <TableCell>Phone Number</TableCell>
            <TableCell>Last Visit</TableCell>
            <TableCell>Expiry</TableCell>
            <TableCell align="right">Amount Owing</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.map((m) => (
            <TableRow
              key={m.id}
              hover
              onClick={() => onRowClick?.(m)}
              sx={{
                cursor: onRowClick ? "pointer" : "default",
                "& td": { borderBottom: "1px solid", borderColor: "divider" },
              }}
            >
              <TableCell>
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    fontSize: 12,
                    fontWeight: 900,
                    bgcolor: alpha(theme.palette.primary.main, 0.10),
                    color: theme.palette.primary.main,
                    border: "1px solid",
                    borderColor: alpha(theme.palette.primary.main, 0.18),
                  }}
                >
                  {initials(m.firstName, m.lastName)}
                </Avatar>
              </TableCell>

              <TableCell sx={{ fontWeight: 900 }}>
                {m.firstName} {m.lastName}
              </TableCell>

              <TableCell>{fmtDate(m.dateJoined)}</TableCell>
              <TableCell>{m.phone || "-"}</TableCell>
              <TableCell>{fmtDate(m.lastVisit)}</TableCell>
              <TableCell>{fmtDate(m.expiry)}</TableCell>

              <TableCell align="right">
                <Typography sx={{ fontWeight: 900 }}>
                  {Number(m.amountOwing || 0).toLocaleString()}{" "}
                  <Typography component="span" sx={{ fontWeight: 800, color: "text.secondary" }}>
                    XAF
                  </Typography>
                </Typography>
              </TableCell>
            </TableRow>
          ))}

          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
                  <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                    No members found.
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
