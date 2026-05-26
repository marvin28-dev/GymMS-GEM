import React, { useMemo, useState } from "react";
import {
  Box,
  Chip,
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

function formatAccess(access = []) {
  return access.join(" / ");
}

function formatMoneyXaf(n) {
  const v = Number(n || 0);
  return v.toLocaleString("fr-FR");
}
function PackagesTable({ rows, onEdit, onDelete }) {
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
          No packages yet.
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
              <TableCell>Access</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Enrolled Members</TableCell>
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
                  "& td": {
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    verticalAlign: "middle",
                  },
                }}
              >
                <TableCell sx={{ fontWeight: 900 }}>{r.title}</TableCell>

                <TableCell>
                  <Chip
                    label={formatAccess(r.access)}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 900 }}
                  />
                </TableCell>

                <TableCell sx={{ fontWeight: 900 }}>
                  {formatMoneyXaf(r.price)} <span style={{ fontWeight: 800, opacity: 0.7 }}>XAF</span>
                </TableCell>

                <TableCell sx={{ fontWeight: 900 }}>{Number(r.enrolledCount || 0)}</TableCell>

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
            onEdit?.(row);
          }}
          sx={{ fontWeight: 900 }}
        >
          Edit
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
export default PackagesTable;