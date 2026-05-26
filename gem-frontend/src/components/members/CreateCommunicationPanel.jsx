// src/components/members/CreateCommunicationPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Box,
    Button,
    FormControl,
    MenuItem,
    Select,
    Typography,
    Autocomplete,
    Chip,
    TextField,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import GemCard from "../ui/GemCard";
import GemTextField from "../ui/GemTextField";


function FieldBlock({ title, children }) {
    return (
        <Box sx={{ display: "grid", gap: 0.75 }}>
            <Typography sx={{ fontWeight: 950, fontSize: 13 }} color="text.secondary">
                {title}
            </Typography>
            {children}
        </Box>
    );
}

function isExpired(expiryIso) {
    if (!expiryIso) return false;
    const today = new Date();
    const exp = new Date(`${expiryIso}T23:59:59`);
    return exp < today;
}

function memberLabel(m) {
    const name = `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Member";
    const contact = m.email || m.phone || "—";
    return `${name} — ${contact}`;
}

export default function CreateCommunicationPanel({ members = [], onCancel, onSend }) {
    const [title, setTitle] = useState("");
    const [media, setMedia] = useState("Phone");
    const [category, setCategory] = useState("Debtors");
    const [audience, setAudience] = useState("debtors"); // all | active | expired | debtors | custom
    const [message, setMessage] = useState("");
    const [fileName, setFileName] = useState("");

    // ✅ single source of truth for recipients
    const [selected, setSelected] = useState([]);

    // ✅ options for Autocomplete
    const options = useMemo(() => {
        return (members || []).map((m) => ({
            id: m.id,
            raw: m,
            name: `${m.firstName || ""} ${m.lastName || ""}`.trim(),
            phone: m.phone || "",
            email: m.email || "",
            expiry: m.expiry || "",
            amountOwing: Number(m.amountOwing || 0),
            label: memberLabel(m),
        }));
    }, [members]);

    // ✅ auto recipients based on audience
    const autoRecipients = useMemo(() => {
        let filtered = options;

        if (audience === "active") filtered = options.filter((o) => !isExpired(o.expiry));
        if (audience === "expired") filtered = options.filter((o) => isExpired(o.expiry));
        if (audience === "debtors") filtered = options.filter((o) => Number(o.amountOwing || 0) > 0);
        if (audience === "all") filtered = options;

        return filtered;
    }, [options, audience]);

    // ✅ auto-populate except custom
    useEffect(() => {
        if (audience === "custom") return;
        setSelected(autoRecipients);
    }, [audience, autoRecipients]);

    const canSend = useMemo(() => {
        return title.trim().length > 0 && message.trim().length > 0 && selected.length > 0;
    }, [title, message, selected]);

    const handleAttach = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFileName(f.name);
    };

    const handleSend = () => {
        if (!canSend) return;

        onSend?.({
            title: title.trim(),
            media,
            category,
            sent: selected.length,
            total: selected.length,
            message: message.trim(),
            attachmentName: fileName || null,
            recipients: selected.map((s) => ({
                memberId: s.id,
                label: s.label,
            })),
        });
    };

    return (
        <GemCard contentSx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 950, mb: 2 }}>Create a New Communication</Typography>

            <Box sx={{ display: "grid", gap: 2 }}>
                <FieldBlock title="Title">
                    <GemTextField value={title} onChange={(e) => setTitle(e.target.value)} placeholder="PayBill" />
                </FieldBlock>

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                        gap: 2,
                    }}
                >
                    <FieldBlock title="Media">
                        <FormControl fullWidth size="small">
                            <Select value={media} onChange={(e) => setMedia(e.target.value)} sx={{ fontWeight: 900 }}>
                                <MenuItem value="Phone">Phone</MenuItem>
                                <MenuItem value="Email">Email</MenuItem>
                                <MenuItem value="Email/Phone">Email/Phone</MenuItem>
                            </Select>
                        </FormControl>
                    </FieldBlock>

                    <FieldBlock title="Category">
                        <FormControl fullWidth size="small">
                            <Select value={category} onChange={(e) => setCategory(e.target.value)} sx={{ fontWeight: 900 }}>
                                <MenuItem value="Debtors">Debtors</MenuItem>
                                <MenuItem value="Marketing">Marketing</MenuItem>
                                <MenuItem value="Gift">Gift</MenuItem>
                                <MenuItem value="Personal">Personal</MenuItem>
                            </Select>
                        </FormControl>
                    </FieldBlock>
                </Box>

                <FieldBlock title="Target Audience">
                    <FormControl fullWidth size="small">
                        <Select value={audience} onChange={(e) => setAudience(e.target.value)} sx={{ fontWeight: 900 }}>
                            <MenuItem value="all">All Members</MenuItem>
                            <MenuItem value="active">Active Members</MenuItem>
                            <MenuItem value="expired">Expired Members</MenuItem>
                            <MenuItem value="debtors">Debtors (Owing)</MenuItem>
                            <MenuItem value="custom">Custom</MenuItem>
                        </Select>
                    </FormControl>
                </FieldBlock>

                <FieldBlock title={`Recipients (${selected.length})`}>
                    <Autocomplete
                        multiple
                        disableCloseOnSelect
                        options={options}
                        value={selected}
                        onChange={(_, v) => setSelected(v)}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        getOptionLabel={(o) => o.label || `${o.name} — ${o.phone}`}
                        filterSelectedOptions

                        // ✅ FIX: control chips layout + padding safely
                        renderTags={(value, getTagProps) => (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 0.75,

                                    // ✅ breathing room so chips NEVER touch border
                                    pt: 0.75,
                                    pb: 0.5,
                                    pl: 1,
                                    pr: 0.5,

                                    // ✅ if many chips, scroll inside (not on the border)
                                    maxHeight: 92,
                                    overflowY: "auto",
                                }}
                            >
                                {value.map((option, index) => (
                                    <Chip
                                        key={option.id ?? index}
                                        label={option.label}
                                        {...getTagProps({ index })}
                                        sx={{
                                            height: 26,
                                            borderRadius: 999,
                                            maxWidth: "100%",
                                            "& .MuiChip-label": {
                                                fontWeight: 700,
                                                maxWidth: { xs: 150, sm: 240 },
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            },
                                        }}
                                    />
                                ))}
                            </Box>
                        )}

                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label=""                 // ✅ removes tiny border label
                                placeholder="Select recipients..."
                            />
                        )}
                        sx={{
                            // ✅ more square container
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 2,            // was 4 (round). Now more square.
                                alignItems: "flex-start",
                                minHeight: 68,
                                padding: "8px 46px 8px 10px", // more left padding so first chip + cursor never touch border
                            },

                            // ✅ cursor / typing area spacing (keeps caret off the border)
                            "& .MuiAutocomplete-input": {
                                minWidth: 160,
                                padding: "10px 6px !important",
                                margin: 0,
                            },

                            // ✅ keep end icons centered nicely
                            "& .MuiAutocomplete-endAdornment": {
                                top: 10,                 // ✅ stick near the top
                                transform: "none",       // ✅ remove centering
                            },
                        }}

                    />


                </FieldBlock>



                <FieldBlock title="Message">
                    <GemTextField
                        multiline
                        minRows={6}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Write your message..."
                    />
                </FieldBlock>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Button component="label" startIcon={<AttachFileIcon />} variant="text" sx={{ fontWeight: 950 }}>
                        Attach File
                        <input hidden type="file" onChange={handleAttach} />
                    </Button>
                    {fileName ? (
                        <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                            {fileName}
                        </Typography>
                    ) : null}
                </Box>

                <Box
                    sx={{
                        pt: 1,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 2,
                        flexWrap: "wrap",
                    }}
                >
                    <Button variant="contained" onClick={handleSend} disabled={!canSend} sx={{ fontWeight: 950 }}>
                        Send Communication
                    </Button>

                    <Button variant="outlined" onClick={onCancel} sx={{ fontWeight: 950 }}>
                        Cancel
                    </Button>
                </Box>
            </Box>
        </GemCard>
    );
}
