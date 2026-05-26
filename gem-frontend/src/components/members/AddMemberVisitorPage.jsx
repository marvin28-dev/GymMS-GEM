// src/components/members/AddMemberVisitorPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Radio,
  RadioGroup,
  FormControlLabel,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  MenuItem,
  Select,
  FormControl,
  InputAdornment,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";

import GemCard from "../ui/GemCard";
import GemTextField from "../ui/GemTextField";
import { uploadPhoto } from "../../services/upload.service";

function FieldBlock({ title, children }) {
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Typography
        sx={{ fontWeight: 950, fontSize: 12.5, letterSpacing: 0.2 }}
        color="text.secondary"
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Section({ title, children }) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 4,
        backgroundColor: "rgba(15, 23, 42, 0.02)",
        boxShadow: "0 10px 24px rgba(2,6,23,0.05)",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: { xs: 2, sm: 2.5 }, pb: 1.5 }}>
        <Typography sx={{ fontWeight: 950, fontSize: 15 }}>{title}</Typography>
      </Box>
      <Divider sx={{ opacity: 0.55 }} />
      <Box sx={{ p: { xs: 2, sm: 2.5 }, display: "grid", gap: 2 }}>
        {children}
      </Box>
    </Box>
  );
}

export default function AddMemberVisitorPage({
  initialType = "member",
  onCancel,
  onClose,
  onSave,
  onSaved,
}) {
  const close = onCancel || onClose;
  const save = onSave || onSaved;

  const [personType, setPersonType] = useState(initialType);

  // Member details
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("Male");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");

  // Address (member only)
  const [streetNumber, setStreetNumber] = useState("");
  const [streetName, setStreetName] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");

  // Emergency
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");

  // Membership
  const [membershipOption, setMembershipOption] = useState("MEM-OPTION 1");
  const [price, setPrice] = useState("20000");
  const [sessionQty, setSessionQty] = useState("6"); // visitor only

  // Hearing
  const [heardAboutUs, setHeardAboutUs] = useState("Referral");
  const [sayMore, setSayMore] = useState("");

  // ✅ Single image (either upload OR camera)
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState(""); // Cloudinary URL
  const [photoSource, setPhotoSource] = useState(""); // "upload" | "camera" | ""
  const [photoUploading, setPhotoUploading] = useState(false);

  const isVisitor = personType === "visitor";

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSinglePhoto = async (file, source) => {
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    const objUrl = URL.createObjectURL(file);
    setPhotoPreview(objUrl);
    setPhotoSource(source);
    // Upload to Cloudinary
    setPhotoUploading(true);
    try {
      const url = await uploadPhoto(file, 'gem/members');
      setPhotoDataUrl(url);
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleChooseImage = async (e) => {
    const file = e.target.files?.[0];
    await setSinglePhoto(file, "upload");
    // allow selecting same file again
    e.target.value = "";
  };

  const handleOpenCamera = async (e) => {
    const file = e.target.files?.[0];
    await setSinglePhoto(file, "camera");
    e.target.value = "";
  };

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview("");
    setPhotoDataUrl("");
    setPhotoSource("");
  };

  const canSubmit = useMemo(() => {
    return Boolean(firstName.trim() && lastName.trim() && phone.trim());
  }, [firstName, lastName, phone]);

  const handleSubmit = () => {
    if (!canSubmit) return;

    const payload = {
      personType,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),

      details: {
        gender,
        email: email.trim(),
        dob,

        address: isVisitor
          ? null
          : {
              streetNumber: streetNumber.trim(),
              streetName: streetName.trim(),
              city: city.trim(),
              postalCode: postalCode.trim(),
              country: country.trim(),
            },

        emergencyContact: {
          name: emergencyName.trim(),
          phone: emergencyPhone.trim(),
          relation: emergencyRelation.trim(),
        },

        heardAboutUs,
        sayMore: sayMore.trim(),

        // ✅ single image stored here (only for members)
        identification: isVisitor
          ? null
          : {
              photo: photoDataUrl || null,
              photoSource: photoSource || null, // upload|camera
            },
      },

      membership: isVisitor
        ? {
            option: membershipOption,
            sessionQty: Number(sessionQty || 0),
            price: Number(price || 0),
          }
        : {
            option: membershipOption,
            price: Number(price || 0),
          },
    };

    save?.(payload);
  };

  return (
    <GemCard contentSx={{ p: { xs: 1.5, sm: 2 } }}>
      {/* Top header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          mb: 1.25,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <Typography sx={{ fontWeight: 950, fontSize: 16 }}>Add a new</Typography>

          <RadioGroup
            row
            value={personType}
            onChange={(e) => setPersonType(e.target.value)}
            sx={{
              "& .MuiFormControlLabel-label": { fontWeight: 900, fontSize: 13 },
              "& .MuiRadio-root": { p: 0.6 },
            }}
          >
            <FormControlLabel value="member" control={<Radio />} label="Member" />
            <FormControlLabel value="visitor" control={<Radio />} label="Visitor" />
          </RadioGroup>
        </Box>

        <IconButton
          onClick={close}
          size="small"
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2.5,
            width: 36,
            height: 36,
          }}
          aria-label="close"
        >
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <Divider sx={{ my: 1.25 }} />

      <Box sx={{ display: "grid", gap: 2 }}>
        {/* Member Details */}
        <Section title="Member Details">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <FieldBlock title="First Name">
              <GemTextField value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </FieldBlock>

            <FieldBlock title="Last Name">
              <GemTextField value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </FieldBlock>

            <FieldBlock title="Gender">
              <ToggleButtonGroup
                exclusive
                value={gender}
                onChange={(_, v) => v && setGender(v)}
                sx={{
                  bgcolor: "rgba(15, 23, 42, 0.03)",
                  p: 0.5,
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.35)",
                  width: "fit-content",
                  "& .MuiToggleButton-root": {
                    border: 0,
                    borderRadius: 999,
                    px: 2,
                    py: 0.8,
                    fontWeight: 900,
                    textTransform: "none",
                    color: "text.secondary",
                  },
                  "& .MuiToggleButton-root.Mui-selected": {
                    backgroundColor: "#4338CA",
                    color: "#fff",
                  },
                  "& .MuiToggleButton-root.Mui-selected:hover": {
                    backgroundColor: "#3b33b5",
                  },
                }}
              >
                <ToggleButton value="Male">Male</ToggleButton>
                <ToggleButton value="Female">Female</ToggleButton>
                <ToggleButton value="Other">Other</ToggleButton>
              </ToggleButtonGroup>
            </FieldBlock>

            <FieldBlock title="Email">
              <GemTextField value={email} onChange={(e) => setEmail(e.target.value)} />
            </FieldBlock>

            <FieldBlock title="Phone">
              <GemTextField value={phone} onChange={(e) => setPhone(e.target.value)} />
            </FieldBlock>

            <FieldBlock title="Date Of Birth">
              <GemTextField type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </FieldBlock>
          </Box>
        </Section>

        {/* Address (member only) */}
        {!isVisitor && (
          <Section title="Address">
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                gap: 2,
              }}
            >
              <FieldBlock title="Street Number">
                <GemTextField value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} />
              </FieldBlock>

              <FieldBlock title="Street Name">
                <GemTextField value={streetName} onChange={(e) => setStreetName(e.target.value)} />
              </FieldBlock>

              <FieldBlock title="City">
                <GemTextField value={city} onChange={(e) => setCity(e.target.value)} />
              </FieldBlock>

              <FieldBlock title="Postal Code">
                <GemTextField value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </FieldBlock>

              <FieldBlock title="Country">
                <GemTextField value={country} onChange={(e) => setCountry(e.target.value)} />
              </FieldBlock>
            </Box>
          </Section>
        )}

        {/* Emergency */}
        <Section title="Emergency Contact">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
              gap: 2,
            }}
          >
            <FieldBlock title="Contact Name">
              <GemTextField value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
            </FieldBlock>

            <FieldBlock title="Phone Number">
              <GemTextField value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
            </FieldBlock>

            <FieldBlock title="Relation">
              <GemTextField value={emergencyRelation} onChange={(e) => setEmergencyRelation(e.target.value)} />
            </FieldBlock>
          </Box>
        </Section>

        {/* Membership */}
        <Section title="Membership">
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: isVisitor
                ? { xs: "1fr", md: "1fr 1fr 1fr" }
                : { xs: "1fr", md: "1fr 1fr" },
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
                  <MenuItem value="MEM-OPTION 1">MEM-OPTION 1</MenuItem>
                  <MenuItem value="MEM-OPTION 2">MEM-OPTION 2</MenuItem>
                  <MenuItem value="MEM-OPTION 3">MEM-OPTION 3</MenuItem>
                </Select>
              </FormControl>
            </FieldBlock>

            {isVisitor && (
              <FieldBlock title="Session Qty">
                <FormControl fullWidth size="small">
                  <Select
                    value={sessionQty}
                    onChange={(e) => setSessionQty(e.target.value)}
                    sx={{ fontWeight: 950 }}
                  >
                    <MenuItem value="1">1</MenuItem>
                    <MenuItem value="3">3</MenuItem>
                    <MenuItem value="6">6</MenuItem>
                    <MenuItem value="12">12</MenuItem>
                  </Select>
                </FormControl>
              </FieldBlock>
            )}

            <FieldBlock title="Price">
              <GemTextField
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="20000"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography sx={{ fontWeight: 950 }} color="text.secondary">
                        FCFA
                      </Typography>
                    </InputAdornment>
                  ),
                }}
              />
            </FieldBlock>
          </Box>
        </Section>

        {/* Identification (member only) */}
        {!isVisitor && (
          <Section title="Identification">
            {/* ✅ joined buttons + single preview */}
            <Box sx={{ display: "grid", gap: 1.25 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1.5,
                  flexWrap: "wrap",
                }}
              >
                <Typography sx={{ fontWeight: 950, fontSize: 13 }} color="text.secondary">
                  Photo
                </Typography>

                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={<CloudUploadOutlinedIcon />}
                    sx={{ fontWeight: 950 }}
                  >
                    Choose Image
                    <input hidden type="file" accept="image/*" onChange={handleChooseImage} />
                  </Button>

                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={<PhotoCameraOutlinedIcon />}
                    sx={{ fontWeight: 950 }}
                  >
                    Open Camera
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleOpenCamera}
                    />
                  </Button>

                  {photoPreview ? (
                    <Button variant="text" onClick={clearPhoto} sx={{ fontWeight: 950 }}>
                      Remove
                    </Button>
                  ) : null}
                </Box>
              </Box>

              <Box
                sx={{
                  width: "100%",
                  height: 190,
                  borderRadius: 3,
                  border: "1px solid rgba(148,163,184,0.35)",
                  bgcolor: "rgba(15, 23, 42, 0.02)",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {photoPreview ? (
                  <Box
                    component="img"
                    src={photoPreview}
                    alt="Selected preview"
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Typography color="text.secondary" sx={{ fontWeight: 800 }}>
                    No image selected
                  </Typography>
                )}
              </Box>

              {photoPreview ? (
                <Typography sx={{ fontWeight: 850, fontSize: 12.5 }} color="text.secondary">
                  Source: {photoSource === "camera" ? "Camera" : "Upload"}
                </Typography>
              ) : null}
            </Box>
          </Section>
        )}

        {/* How did you hear */}
        <Section title="How did you hear about us ?">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "420px 1fr" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <FieldBlock title="Option">
              <FormControl fullWidth size="small">
                <Select
                  value={heardAboutUs}
                  onChange={(e) => setHeardAboutUs(e.target.value)}
                  sx={{ fontWeight: 950 }}
                >
                  <MenuItem value="Referral">Referral</MenuItem>
                  <MenuItem value="Instagram">Instagram</MenuItem>
                  <MenuItem value="Facebook">Facebook</MenuItem>
                  <MenuItem value="Friend">Friend</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </FieldBlock>

            <FieldBlock title="Say More">
              <GemTextField
                multiline
                value={sayMore}
                onChange={(e) => setSayMore(e.target.value)}
                placeholder="Type here..."
                minRows={4}
                maxRows={6}
                sx={{
                  "& .MuiOutlinedInput-root": { borderRadius: 3, alignItems: "flex-start" },
                  "& textarea": { paddingTop: 10 },
                }}
              />
            </FieldBlock>
          </Box>
        </Section>

        {/* Bottom CTA */}
        <Box sx={{ display: "flex", justifyContent: "center", pt: 0.5 }}>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!canSubmit}
            sx={{ fontWeight: 950, px: 4, py: 1.2, borderRadius: 999 }}
          >
            Complete Signup
          </Button>
        </Box>
      </Box>
    </GemCard>
  );
}
