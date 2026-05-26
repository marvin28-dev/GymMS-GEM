// src/pages/Members.jsx
import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useNavigate } from "react-router-dom";

import GemCard from "../components/ui/GemCard";
import GemTextField from "../components/ui/GemTextField";

import MembersTable from "../components/members/MembersTable";


import PackagesTable from "../components/members/PackagesTable";
import { defaultPackages } from "../data/mockPackages";
import AddMemberVisitorPage from "../components/members/AddMemberVisitorPage";
import CommunicationsTable from "../components/members/CommunicationsTable";
import { defaultCommunications } from "../data/mockCommunications";
import CreateCommunicationPanel from "../components/members/CreateCommunicationPanel";
import AddPackageDialog from "../components/members/AddPackageDialog";

import { defaultMembers } from "../data/mockMembers";

const LS_MEMBERS_KEY = "gem_members_v1";
const LS_PACKAGES_KEY = "gem_packages_v1";
const LS_COMM_KEY = "gem_communications_v1";

const DETAILS_KEY = (id) => `gem_member_details_v1_${id}`;
const MEMBERSHIP_KEY = (id) => `gem_member_membership_v1_${id}`;

// ---------------------
// localStorage helpers
// ---------------------
function loadArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveArray(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows));
}

function isExpired(expiryIso) {
  if (!expiryIso) return false;
  const today = new Date();
  const exp = new Date(`${expiryIso}T23:59:59`);
  return exp < today;
}

export default function Members() {
  const navigate = useNavigate();
  const [memberSubview, setMemberSubview] = useState("list"); // "list" | "add"
  const [subView, setSubView] = useState("list"); // "list" | "add"



  // Tabs: 0 list, 1 packages, 2 communications
  const [tab, setTab] = useState(0);

  // ---------------------
  // Members
  // ---------------------
  const [members, setMembers] = useState(() => {
    const stored = loadArray(LS_MEMBERS_KEY);
    if (stored) return stored;
    saveArray(LS_MEMBERS_KEY, defaultMembers);
    return defaultMembers;
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();

    let rows = members.filter((m) => {
      const name = `${m.firstName} ${m.lastName}`.toLowerCase();
      const phone = (m.phone || "").toLowerCase();
      return !q || name.includes(q) || phone.includes(q);
    });

    if (filter === "active") rows = rows.filter((m) => !isExpired(m.expiry));
    if (filter === "expired") rows = rows.filter((m) => isExpired(m.expiry));
    if (filter === "owing") rows = rows.filter((m) => Number(m.amountOwing || 0) > 0);

    return rows;
  }, [members, search, filter]);

  const handleExportPdf = () => {
    alert("PDF export will be implemented later (backend + real PDF).");
  };

  const handleRowClick = (m) => {
    navigate(`/members/${m.id}`);
  };

  // when Add Member/Visitor page saves, it should call this (kept here for backend later)
  const handleAddMember = (payload) => {
    const id = `mem_${Date.now()}`;
    const isVisitor = payload.personType === "visitor";

    const newMember = {
      id,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone || "",
      dateJoined: new Date().toISOString().slice(0, 10),
      lastVisit: new Date().toISOString().slice(0, 10),
      amountOwing: isVisitor
        ? 0
        : Number(payload.membership?.amountOwing || payload.membership?.cost || 0),
      expiry: "",
    };

    // Save left-panel details for profile
    localStorage.setItem(
      DETAILS_KEY(id),
      JSON.stringify({
        ...(payload.details || {}),
        owing: newMember.amountOwing,
        profileExpiry: newMember.expiry,
      })
    );

    // Save membership info
    if (payload.membership) {
      localStorage.setItem(MEMBERSHIP_KEY(id), JSON.stringify(payload.membership));
    }

    const next = [newMember, ...members];
    setMembers(next);
    saveArray(LS_MEMBERS_KEY, next);
  };

  // ---------------------
  // Packages
  // ---------------------
  const [packages, setPackages] = useState(() => {
    const stored = loadArray(LS_PACKAGES_KEY);
    if (stored) return stored;
    saveArray(LS_PACKAGES_KEY, defaultPackages);
    return defaultPackages;
  });

  const [packageFilter, setPackageFilter] = useState("all");
  const [openPkg, setOpenPkg] = useState(false);
  const [pkgMode, setPkgMode] = useState("create"); // create | edit
  const [pkgEditing, setPkgEditing] = useState(null);

  const filteredPackages = useMemo(() => {
    if (packageFilter === "all") return packages;
    return packages.filter((p) => (p.access || []).includes(packageFilter));
  }, [packages, packageFilter]);

  const handleAddPackage = () => {
    setPkgMode("create");
    setPkgEditing(null);
    setOpenPkg(true);
  };

  const handleEditPackage = (row) => {
    setPkgMode("edit");
    setPkgEditing(row);
    setOpenPkg(true);
  };

  const handleDeletePackage = (row) => {
    if (!row?.id) return;
    const next = packages.filter((p) => p.id !== row.id);
    setPackages(next);
    saveArray(LS_PACKAGES_KEY, next);
  };

  const handleSavePackage = (payload) => {
    if (pkgMode === "edit" && pkgEditing?.id) {
      const next = packages.map((p) => (p.id === pkgEditing.id ? { ...p, ...payload } : p));
      setPackages(next);
      saveArray(LS_PACKAGES_KEY, next);
      setOpenPkg(false);
      return;
    }

    const nextPkg = { id: `pkg_${Date.now()}`, ...payload };
    const next = [nextPkg, ...packages];
    setPackages(next);
    saveArray(LS_PACKAGES_KEY, next);
    setOpenPkg(false);
  };

  // ---------------------
  // Communications
  // ---------------------
  const [communications, setCommunications] = useState(() => {
    const stored = loadArray(LS_COMM_KEY);
    if (stored) return stored;
    saveArray(LS_COMM_KEY, defaultCommunications);
    return defaultCommunications;
  });

  const [commFilter, setCommFilter] = useState("all");

  // ✅ this MUST be inside the component
  const [creatingComm, setCreatingComm] = useState(false);

  const filteredCommunications = useMemo(() => {
    if (commFilter === "all") return communications;

    // category filters
    if (["Debtors", "Marketing", "Gift", "Personal"].includes(commFilter)) {
      return communications.filter((c) => c.category === commFilter);
    }

    // media filters
    if (["Phone", "Email", "Email/Phone"].includes(commFilter)) {
      return communications.filter((c) => c.media === commFilter);
    }

    return communications;
  }, [communications, commFilter]);

  const handleSendCommunication = (payload) => {
    const newRow = {
      id: `comm_${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString(),
    };
    const next = [newRow, ...communications];
    setCommunications(next);
    saveArray(LS_COMM_KEY, next);
  };

  const handleDeleteCommunication = (row) => {
    if (!row?.id) return;
    const next = communications.filter((c) => c.id !== row.id);
    setCommunications(next);
    saveArray(LS_COMM_KEY, next);
  };

  const handleViewCommunication = (row) => {
    if (!row) return;
    alert(
      `Title: ${row.title}\nMedia: ${row.media}\nCategory: ${row.category}\nQty: ${row.sent}/${row.total}\n\nMessage:\n${row.message}`
    );
  };
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let rows = members.filter((m) => {
      const name = `${m.firstName} ${m.lastName}`.toLowerCase();
      const phone = (m.phone || "").toLowerCase();
      return !q || name.includes(q) || phone.includes(q);
    });

    if (filter === "active") rows = rows.filter((m) => !isExpired(m.expiry));
    if (filter === "expired") rows = rows.filter((m) => isExpired(m.expiry));
    if (filter === "owing") rows = rows.filter((m) => Number(m.amountOwing || 0) > 0);

    return rows;
  }, [members, search, filter]);


  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5">Members</Typography>
          <Typography variant="body2" color="text.secondary">
            Find all Members Here
          </Typography>
        </Box>
      </Box>

      <GemCard contentSx={{ p: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 2, "& .MuiTab-root": { fontWeight: 900 } }}
        >
          <Tab label="MEMBER LIST" />
          <Tab label="PACKAGES" />
          <Tab label="SEND COMMUNICATION" />
        </Tabs>

        {/* MEMBER LIST */}
        {tab === 0 && (
          memberSubview === "add" ? (
            <AddMemberVisitorPage
              onCancel={() => setMemberSubview("list")}
              onSave={(payload) => {
                handleAddMember(payload);
                setMemberSubview("list");
              }}
            />
          ) : (
            <Box sx={{ display: "grid", gap: 2 }}>
              {/* Toolbar row */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  <Box sx={{ width: { xs: "100%", sm: 260 } }}>
                    <GemTextField
                      placeholder="Search member"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </Box>

                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setMemberSubview("add")}
                    sx={{ fontWeight: 900 }}
                  >
                    Add New Member
                  </Button>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, flexWrap: "wrap" }}>
                  <Button
                    variant="outlined"
                    startIcon={<PictureAsPdfIcon />}
                    onClick={handleExportPdf}
                    sx={{ fontWeight: 900 }}
                  >
                    Export to PDF
                  </Button>

                  <FormControl size="small" sx={{ width: 170 }}>
                    <Select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      sx={{ fontWeight: 900 }}
                    >
                      <MenuItem value="all">Filter: All</MenuItem>
                      <MenuItem value="active">Filter: Active</MenuItem>
                      <MenuItem value="expired">Filter: Expired</MenuItem>
                      <MenuItem value="owing">Filter: Owing</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {/* Table */}
              <MembersTable rows={filtered} onRowClick={handleRowClick} />
            </Box>
          )
        )}



        {/* PACKAGES */}
        {tab === 1 && (
          <Box sx={{ display: "grid", gap: 2 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddPackage}
                sx={{ fontWeight: 900 }}
              >
                Add New Package
              </Button>

              <FormControl size="small" sx={{ width: 190 }}>
                <Select
                  value={packageFilter}
                  onChange={(e) => setPackageFilter(e.target.value)}
                  sx={{ fontWeight: 900 }}
                >
                  <MenuItem value="all">Filter: All</MenuItem>
                  <MenuItem value="Gym">Filter: Gym</MenuItem>
                  <MenuItem value="Cardio">Filter: Cardio</MenuItem>
                  <MenuItem value="Musculation">Filter: Musculation</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <PackagesTable rows={filteredPackages} onEdit={handleEditPackage} onDelete={handleDeletePackage} />

            <AddPackageDialog
              open={openPkg}
              mode={pkgMode}
              initial={pkgEditing}
              onClose={() => setOpenPkg(false)}
              onSave={handleSavePackage}
            />
          </Box>
        )}

        {/* SEND COMMUNICATION */}
        {tab === 2 && (
          <Box sx={{ display: "grid", gap: 2 }}>
            {!creatingComm ? (
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreatingComm(true)}
                    sx={{ fontWeight: 900 }}
                  >
                    Send New Communication
                  </Button>

                  <FormControl size="small" sx={{ width: 190 }}>
                    <Select
                      value={commFilter}
                      onChange={(e) => setCommFilter(e.target.value)}
                      sx={{ fontWeight: 900 }}
                    >
                      <MenuItem value="all">Filter: All</MenuItem>
                      <MenuItem value="Debtors">Filter: Debtors</MenuItem>
                      <MenuItem value="Marketing">Filter: Marketing</MenuItem>
                      <MenuItem value="Gift">Filter: Gift</MenuItem>
                      <MenuItem value="Personal">Filter: Personal</MenuItem>
                      <MenuItem value="Phone">Filter: Phone</MenuItem>
                      <MenuItem value="Email">Filter: Email</MenuItem>
                      <MenuItem value="Email/Phone">Filter: Email/Phone</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <CommunicationsTable
                  rows={filteredCommunications}
                  onView={handleViewCommunication}
                  onDelete={handleDeleteCommunication}
                />
              </>
            ) : (
              <CreateCommunicationPanel
                members={members}
                onCancel={() => setCreatingComm(false)}
                onSend={(payload) => {
                  handleSendCommunication(payload);
                  setCreatingComm(false);
                }}
              />
            )}
          </Box>
        )}
      </GemCard>

      {/* NOTE:
          - handleAddMember is kept here for future wiring from /members/new page.
          - If you need it now, call it from that page after submit.
      */}
    </Box>
  );
}
