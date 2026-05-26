import React, { useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    Box,
    Button,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputAdornment,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";

import GemCard from "../components/ui/GemCard";
import GemTextField from "../components/ui/GemTextField";

const LS_KEY = "gem_members_v1";
const DETAILS_KEY = (id) => `gem_member_details_v1_${id}`;
const MEMBERSHIP_KEY = (id) => `gem_member_membership_v1_${id}`;

const MEMBERSHIP_OPTIONS = [
    { value: "MEM-OPTION 1", label: "MEM-OPTION 1" },
    { value: "MEM-OPTION 2", label: "MEM-OPTION 2" },
    { value: "MEM-OPTION 3", label: "MEM-OPTION 3" },
];

const HEAR_OPTIONS = [
    { value: "Referral", label: "Referral" },
    { value: "Instagram", label: "Instagram" },
    { value: "Facebook", label: "Facebook" },
    { value: "Walk-in", label: "Walk-in" },
    { value: "Other", label: "Other" },
];

// Visitor “Session Qty” pricing (editable)
const SESSION_PRICING = { 1: 2000, 3: 5000, 6: 9000, 12: 20000 };

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}

function loadMembers() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveMembers(rows) {
    localStorage.setItem(LS_KEY, JSON.stringify(rows));
}

function useQuery() {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}
function AddPerson() {
    const navigate = useNavigate();
    const fileRef = useRef(null);
    const query = useQuery();

    // ✅ Default mode can be set by ?type=visitor or ?type=member
    const initialType = query.get("type") === "visitor" ? "visitor" : "member";
    const [personType, setPersonType] = useState(initialType); // member | visitor

    // Member details (shared)
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [gender, setGender] = useState("Male");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [dob, setDob] = useState("");

    // Address (MEMBER only)
    const [streetNumber, setStreetNumber] = useState("");
    const [streetName, setStreetName] = useState("");
    const [city, setCity] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [country, setCountry] = useState("");

    // Emergency (shared)
    const [emContactName, setEmContactName] = useState("");
    const [emPhone, setEmPhone] = useState("");
    const [emRelation, setEmRelation] = useState("");

    // Membership (shared option, but Visitor uses Session Qty)
    const [membershipOption, setMembershipOption] = useState("MEM-OPTION 1");

    // MEMBER pricing (simple)
    const [memberPrice, setMemberPrice] = useState(20000);

    // VISITOR sessions
    const [sessionQty, setSessionQty] = useState(12);
    const [visitorPrice, setVisitorPrice] = useState(SESSION_PRICING[12]);

    // Identification (MEMBER only)
    const [photoPreview, setPhotoPreview] = useState(null);

    // Referral (shared)
    const [hearAboutUs, setHearAboutUs] = useState("Referral");
    const [sayMore, setSayMore] = useState("");

    const handleCancel = () => navigate(-1);

    const canSubmit = useMemo(() => {
        if (!firstName.trim()) return false;
        if (!lastName.trim()) return false;
        if (!phone.trim()) return false;
        return true;
    }, [firstName, lastName, phone]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setPhotoPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handlePickSession = (qty) => {
        setSessionQty(qty);
        setVisitorPrice(SESSION_PRICING[qty] ?? 0);
    };

    const handleSubmit = () => {
        if (!canSubmit) return;

        const isVisitor = personType === "visitor";
        const id = `${isVisitor ? "vis" : "mem"}_${Date.now()}`;

        const owing = isVisitor ? Number(visitorPrice || 0) : Number(memberPrice || 0);

        // ✅ This is what will map perfectly to backend later
        const baseRow = {
            id,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
            dateJoined: todayISO(),
            lastVisit: todayISO(),
            expiry: "",
            amountOwing: owing,
            personType, // "member" | "visitor"
        };

        // Save profile details (shared + conditional)
        localStorage.setItem(
            DETAILS_KEY(id),
            JSON.stringify({
                phone: phone.trim(),
                email: email.trim(),
                dob,
                gender,

                // Member-only address
                ...(isVisitor
                    ? {}
                    : {
                        address: [streetNumber, streetName, city].filter(Boolean).join(" ").trim(),
                        postalCode: postalCode.trim(),
                        country: country.trim(),
                        photo: photoPreview || null,
                    }),

                emergencyContact: emPhone.trim(),
                emergencyContactName: emContactName.trim(),
                emergencyRelation: emRelation.trim(),

                checkingCode: "12**",
                status: isVisitor ? "Visitor" : "Active Membership",
                owing,
                profileExpiry: "",
                referral: { hearAboutUs, sayMore },
            })
        );

        // Membership object differs slightly (exactly what you want)
        if (isVisitor) {
            localStorage.setItem(
                MEMBERSHIP_KEY(id),
                JSON.stringify({
                    type: "visitor_sessions",
                    plan: membershipOption,
                    sessionQty,
                    cost: Number(visitorPrice || 0),
                    amountPaid: 0,
                    amountOwing: Number(visitorPrice || 0),
                    startDate: todayISO(),
                    endDate: "",
                })
            );
        } else {
            localStorage.setItem(
                MEMBERSHIP_KEY(id),
                JSON.stringify({
                    type: "member_membership",
                    plan: membershipOption,
                    cost: Number(memberPrice || 0),
                    amountPaid: 0,
                    amountOwing: Number(memberPrice || 0),
                    startDate: todayISO(),
                    endDate: "",
                })
            );
        }

        const current = loadMembers();
        saveMembers([baseRow, ...current]);

        navigate(-1);
    };

    return (
        <Box sx={{ display: "grid", gap: 2 }}>
            {/* Page header */}
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
                <Box>
                    <Typography variant="h5">Members</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Find all Members Here
                    </Typography>
                </Box>
            </Box>

            <GemCard contentSx={{ p: 0 }}>
                {/* Fake tabs (wireframe style) */}
                <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                    <Box sx={{ display: "flex", gap: { xs: 2, sm: 4 }, flexWrap: "wrap" }}>
                        <Typography sx={{ fontWeight: 950, borderBottom: "2px solid", borderColor: "text.primary", pb: 0.5 }}>
                            MEMBER LIST
                        </Typography>
                        <Typography sx={{ fontWeight: 900, color: "text.secondary" }}>PACKAGES</Typography>
                        <Typography sx={{ fontWeight: 900, color: "text.secondary" }}>SEND COMMUNICATION</Typography>
                    </Box>
                </Box>

                <Divider />

                <Box sx={{ p: 2 }}>
                    <Box
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 3,
                            overflow: "hidden",
                            bgcolor: "background.paper",
                        }}
                    >
                        {/* Top row */}
                        <Box
                            sx={{
                                px: 2,
                                py: 1.25,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 2,
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                                <Typography sx={{ fontWeight: 950 }}>Add a new</Typography>

                                {/* ✅ SAME PAGE TOGGLE */}
                                <RadioGroup
                                    row
                                    value={personType}
                                    onChange={(e) => setPersonType(e.target.value)}
                                    sx={{
                                        "& .MuiFormControlLabel-label": { fontWeight: 900 },
                                    }}
                                >
                                    <FormControlLabel value="member" control={<Radio size="small" />} label="Member" />
                                    <FormControlLabel value="visitor" control={<Radio size="small" />} label="Visitor" />
                                </RadioGroup>
                            </Box>

                            <IconButton
                                onClick={handleCancel}
                                size="small"
                                sx={{
                                    border: "1px solid",
                                    borderColor: "divider",
                                    bgcolor: "background.paper",
                                    "&:hover": { bgcolor: "background.paper" },
                                }}
                                aria-label="Close"
                            >
                                <CloseRoundedIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <Divider />

                        {/* Scroll area */}
                        <Box sx={{ p: 2, maxHeight: "70vh", overflow: "auto", display: "grid", gap: 2 }}>
                            {/* MEMBER DETAILS (shared) */}
                            <Section title="Member Details">
                                <Row3Aligned>
                                    <FieldBlock title="First Name">
                                        <GemTextField value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                                    </FieldBlock>
                                    <FieldBlock title="Last Name">
                                        <GemTextField value={lastName} onChange={(e) => setLastName(e.target.value)} />
                                    </FieldBlock>
                                    <FieldBlock title="Gender">
                                        <Box
                                            sx={{
                                                border: "1px solid",
                                                borderColor: "divider",
                                                borderRadius: 999,
                                                p: 0.5,
                                                display: "flex",
                                                gap: 0.5,
                                                width: "fit-content",
                                            }}
                                        >
                                            {["Male", "Female", "Other"].map((g) => (
                                                <Button
                                                    key={g}
                                                    size="small"
                                                    onClick={() => setGender(g)}
                                                    variant={gender === g ? "contained" : "text"}
                                                    sx={{ fontWeight: 950, borderRadius: 999, px: 2, minHeight: 32 }}
                                                >
                                                    {g}
                                                </Button>
                                            ))}
                                        </Box>
                                    </FieldBlock>
                                </Row3Aligned>

                                <Row3Aligned sx={{ mt: 2 }}>
                                    <FieldBlock title="Email">
                                        <GemTextField value={email} onChange={(e) => setEmail(e.target.value)} />
                                    </FieldBlock>
                                    <FieldBlock title="Phone">
                                        <GemTextField value={phone} onChange={(e) => setPhone(e.target.value)} />
                                    </FieldBlock>
                                    <FieldBlock title="Date Of Birth">
                                        <GemTextField type="date" value={dob} onChange={(e) => setDob(e.target.value)} InputLabelProps={{ shrink: true }} />
                                    </FieldBlock>
                                </Row3Aligned>
                            </Section>

                            {/* ✅ ADDRESS (MEMBER ONLY) */}
                            {personType === "member" && (
                                <Section title="Address">
                                    <Row3Aligned>
                                        <FieldBlock title="Street Number">
                                            <GemTextField value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} />
                                        </FieldBlock>
                                        <FieldBlock title="Street Name">
                                            <GemTextField value={streetName} onChange={(e) => setStreetName(e.target.value)} />
                                        </FieldBlock>
                                        <FieldBlock title="City">
                                            <GemTextField value={city} onChange={(e) => setCity(e.target.value)} />
                                        </FieldBlock>
                                    </Row3Aligned>

                                    <Row3Aligned sx={{ mt: 2 }}>
                                        <FieldBlock title="Postal Code">
                                            <GemTextField value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                                        </FieldBlock>
                                        <FieldBlock title="Country">
                                            <GemTextField value={country} onChange={(e) => setCountry(e.target.value)} />
                                        </FieldBlock>
                                        <Box />
                                    </Row3Aligned>
                                </Section>
                            )}

                            {/* EMERGENCY (shared) */}
                            <Section title="Emergency Contact">
                                <Row3Aligned>
                                    <FieldBlock title="Contact Name">
                                        <GemTextField value={emContactName} onChange={(e) => setEmContactName(e.target.value)} />
                                    </FieldBlock>
                                    <FieldBlock title="Phone Number">
                                        <GemTextField value={emPhone} onChange={(e) => setEmPhone(e.target.value)} />
                                    </FieldBlock>
                                    <FieldBlock title="Relation">
                                        <GemTextField value={emRelation} onChange={(e) => setEmRelation(e.target.value)} />
                                    </FieldBlock>
                                </Row3Aligned>
                            </Section>

                            {/* MEMBERSHIP (differs by type) */}
                            {/* MEMBERSHIP */}
                            <Section title="Membership">
                                {personType === "visitor" ? (
                                    // Visitor: 3 columns (Option | Session Qty | Price)
                                    <Row3Aligned>
                                        <FieldBlock title="Option">
                                            <FormControl fullWidth size="small">
                                                <Select
                                                    value={membershipOption}
                                                    onChange={(e) => setMembershipOption(e.target.value)}
                                                    sx={{ fontWeight: 950 }}
                                                >
                                                    {MEMBERSHIP_OPTIONS.map((o) => (
                                                        <MenuItem key={o.value} value={o.value}>
                                                            {o.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </FieldBlock>

                                        <FieldBlock title="Session Qty">
                                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                                {[1, 3, 6, 12].map((qty) => (
                                                    <Button
                                                        key={qty}
                                                        size="small"
                                                        variant={sessionQty === qty ? "contained" : "outlined"}
                                                        onClick={() => handlePickSession(qty)}
                                                        sx={{ borderRadius: 999, fontWeight: 950, minWidth: 44 }}
                                                    >
                                                        {qty}
                                                    </Button>
                                                ))}
                                            </Box>
                                        </FieldBlock>

                                        <FieldBlock title="Price">
                                            <GemTextField
                                                type="number"
                                                value={visitorPrice}
                                                onChange={(e) => setVisitorPrice(e.target.value)}
                                                InputProps={{ endAdornment: <InputAdornment position="end">XAF</InputAdornment> }}
                                            />
                                        </FieldBlock>
                                    </Row3Aligned>
                                ) : (
                                    // Member: 2 columns (Option | Price) => no ugly empty gap
                                    <Box
                                        sx={{
                                            display: "grid",
                                            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                                            gap: 2,
                                            alignItems: "start",
                                        }}
                                    >
                                        <FieldBlock title="Option">
                                            <FormControl fullWidth size="small">
                                                <Select
                                                    value={membershipOption}
                                                    onChange={(e) => setMembershipOption(e.target.value)}
                                                    sx={{ fontWeight: 950 }}
                                                >
                                                    {MEMBERSHIP_OPTIONS.map((o) => (
                                                        <MenuItem key={o.value} value={o.value}>
                                                            {o.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </FieldBlock>

                                        <FieldBlock title="Price">
                                            <GemTextField
                                                type="number"
                                                value={memberPrice}
                                                onChange={(e) => setMemberPrice(e.target.value)}
                                                InputProps={{ endAdornment: <InputAdornment position="end">XAF</InputAdornment> }}
                                            />
                                        </FieldBlock>
                                    </Box>
                                )}
                            </Section>


                            {/* ✅ IDENTIFICATION (MEMBER ONLY) */}
                            {personType === "member" && (
                                <Section title="Identification">
                                    <Box
                                        sx={{
                                            display: "grid",
                                            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                                            gap: 2,
                                        }}
                                    >
                                        <IdCard
                                            title="Upload Photo"
                                            actionIcon={<UploadFileRoundedIcon />}
                                            actionText="Upload"
                                            onAction={() => fileRef.current?.click()}
                                            preview={photoPreview}
                                        >
                                            <input
                                                ref={fileRef}
                                                type="file"
                                                accept="image/*"
                                                style={{ display: "none" }}
                                                onChange={handleFileChange}
                                            />
                                        </IdCard>

                                        <IdCard
                                            title="Take Photo"
                                            actionIcon={<PhotoCameraRoundedIcon />}
                                            actionText="Take"
                                            onAction={() => alert("Camera capture will be added later.")}
                                            preview={null}
                                        />
                                    </Box>
                                </Section>
                            )}

                            {/* REFERRAL (shared) */}
                            <Section title="How did you hear about us ?">
                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: { xs: "1fr", md: "280px 1fr" },
                                        gap: 2,
                                        alignItems: "start",
                                    }}
                                >
                                    <FieldBlock title="Option">
                                        <FormControl fullWidth size="small">
                                            <Select value={hearAboutUs} onChange={(e) => setHearAboutUs(e.target.value)} sx={{ fontWeight: 950 }}>
                                                {HEAR_OPTIONS.map((o) => (
                                                    <MenuItem key={o.value} value={o.value}>
                                                        {o.label}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </FieldBlock>

                                    <FieldBlock title="Say More">
                                        <GemTextField value={sayMore} onChange={(e) => setSayMore(e.target.value)} multiline minRows={4} fullWidth />
                                    </FieldBlock>
                                </Box>
                            </Section>

                            {/* Submit */}
                            <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                                <Button variant="contained" size="small" onClick={handleSubmit} disabled={!canSubmit} sx={{ fontWeight: 950, px: 4, borderRadius: 1.5 }}>
                                    Complete Signup
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </GemCard>
        </Box>
    );
}

/** SECTION */
function Section({ title, children }) {
    return (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2, bgcolor: "background.paper" }}>
            <Typography sx={{ fontWeight: 950, mb: 1 }}>{title}</Typography>
            {children}
        </Box>
    );
}

/** PERFECT ALIGNMENT GRID */
function Row3Aligned({ children, sx }) {
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                gap: 2,
                alignItems: "start",
                ...sx,
            }}
        >
            {children}
        </Box>
    );
}

/** FIELD WITH TITLE ABOVE */
function FieldBlock({ title, children }) {
    return (
        <Box sx={{ display: "grid", gap: 0.75, alignContent: "start", minHeight: 96 }}>
            <Typography variant="body2" sx={{ fontWeight: 950 }}>
                {title}
            </Typography>
            <Box sx={{ minHeight: 56, display: "flex", alignItems: "center" }}>{children}</Box>
        </Box>
    );
}

/** ID CARD (Member only) */
function IdCard({ title, actionIcon, actionText, onAction, preview, children }) {
    return (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2, display: "grid", gap: 1, minHeight: 160 }}>
            {children}
            <Typography variant="body2" sx={{ fontWeight: 950 }}>
                {title}
            </Typography>
            <Button variant="outlined" size="small" startIcon={actionIcon} onClick={onAction} sx={{ fontWeight: 950, width: "fit-content", borderRadius: 999 }}>
                {actionText}
            </Button>
            <Box sx={{ mt: 1, width: 64, height: 64, borderRadius: 2, border: "1px solid", borderColor: "divider", overflow: "hidden", bgcolor: "background.paper" }}>
                {preview ? <Box component="img" src={preview} alt="preview" sx={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
            </Box>
        </Box>
    );
}
export default AddPerson;