import React, { useMemo, useState } from "react";
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";

function ellipsize(s = "", max = 28) {
  const v = String(s || "");
  if (v.length <= max) return v;
  return v.slice(0, max - 1) + "…";
}

function CommunicationsTable({ rows, onView, onDelete }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [activeRow, setActiveRow] = useState(null);

  const open = Boolean(anchorEl);

  const handleOpenMenu = (e, row) => {
    setAnchorEl(e.currentTarget);
    setActiveRow(row);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setActiveRow(null);
  };

  const hasRows = useMemo(() => Array.isArray(rows) && rows.length > 0, [rows]);

  if (!hasRows) {
    return (
      <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
        <Typography sx={{ fontWeight: 900 }} color="text.secondary">
          No communications yet.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <TableContainer sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Table size="small">
          <TableHead>
            <TableRow
              sx={{
                "& th": {
                  fontWeight: 950,
                  color: "text.secondary",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  whiteSpace: "nowrap",
                },
              }}
            >
              <TableCell>Title</TableCell>
              <TableCell>Media</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Qty Sent</TableCell>
              <TableCell>Message</TableCell>
              <TableCell align="right" sx={{ width: 80 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                hover
                sx={{
                  "& td": { borderBottom: "1px solid", borderColor: "divider" },
                }}
              >
                <TableCell sx={{ fontWeight: 900 }}>{r.title}</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>{r.media}</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>{r.category}</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>
                  {Number(r.sent || 0)}/{Number(r.total || 0)}
                </TableCell>
                <TableCell sx={{ fontWeight: 900, color: "text.secondary" }}>
                  {ellipsize(r.message, 34)}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={(e) => handleOpenMenu(e, r)}>
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleCloseMenu}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <MenuItem
          onClick={() => {
            const row = activeRow;
            handleCloseMenu();
            onView?.(row);
          }}
          sx={{ fontWeight: 900 }}
        >
          View
        </MenuItem>

        <MenuItem
          onClick={() => {
            const row = activeRow;
            handleCloseMenu();
            onDelete?.(row);
          }}
          sx={{ fontWeight: 900, color: "error.main" }}
        >
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}
export default CommunicationsTable;