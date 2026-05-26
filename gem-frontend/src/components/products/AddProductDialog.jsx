// src/components/products/AddProductDialog.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
  InputAdornment,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import GemDialog from "../ui/GemDialog";
import { uploadPhoto } from "../../services/upload.service";

function FieldBlock({ title, children }) {
  return (
    <Box sx={{ display: "grid", gap: 0.75 }}>
      <Typography sx={{ fontWeight: 950, fontSize: 12.5, letterSpacing: 0.2 }} color="text.secondary">
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
      <Box sx={{ p: { xs: 2, sm: 2.5 }, display: "grid", gap: 2 }}>{children}</Box>
    </Box>
  );
}


export default function AddProductDialog({
  open,
  mode = "create", // create | edit
  initial,
  categories = [], // [{id,name,type,description,stockQty}]
  onClose,
  onSave,
}) {
  // General info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Photo (single)
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState(""); // Cloudinary URL
  const [photoName, setPhotoName] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);

  // Pricing
  const [basePrice, setBasePrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState("Almost Expired/ Open Box");
  const [categoryId, setCategoryId] = useState("");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!open) return;

    // reset/seed for edit
    if (mode === "edit" && initial) {
      setName(initial.name || "");
      setDescription(initial.description || "");
      setBasePrice(String(initial.basePrice ?? ""));
      setDiscount(String(initial.discount ?? ""));
      setDiscountType(initial.discountType || "Almost Expired/ Open Box");
      setCategoryId(initial.categoryId || "");
      setQty(Number(initial.qty || 1));

      setPhotoName(initial.photoName || "");
      setPhotoDataUrl(initial.photoDataUrl || "");
      setPhotoPreview(initial.photoDataUrl || "");
      return;
    }

    // create fresh
    setName("");
    setDescription("");
    setBasePrice("");
    setDiscount("");
    setDiscountType("Almost Expired/ Open Box");
    setCategoryId(categories?.[0]?.id || "");
    setQty(1);

    setPhotoName("");
    setPhotoDataUrl("");
    setPhotoPreview("");
  }, [open, mode, initial, categories]);

  const canSave = useMemo(() => {
    return String(name).trim().length > 0 && Number(qty || 0) > 0 && String(categoryId).trim().length > 0 && !photoUploading;
  }, [name, qty, categoryId, photoUploading]);

  const handleChoosePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoName(file.name);
    // Show local preview immediately while upload runs
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
    // Upload to Cloudinary
    setPhotoUploading(true);
    try {
      const url = await uploadPhoto(file, 'gem/products');
      setPhotoDataUrl(url);
      setPhotoPreview(url);
    } catch (err) {
      console.error('Product photo upload failed:', err);
    } finally {
      setPhotoUploading(false);
    }
  };

  const incQty = () => setQty((q) => Math.min(9999, Number(q || 0) + 1));
  const decQty = () => setQty((q) => Math.max(1, Number(q || 0) - 1));

  return (
    <GemDialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 950 }}>
        {mode === "edit" ? "Edit product" : "Add a new product"}
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, display: "grid", gap: 2 }}>
        {/* GENERAL INFORMATION */}
        <Section title="General Information">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 260px" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <Box sx={{ display: "grid", gap: 2 }}>
              <FieldBlock title="Product Name">
                <TextField
                  size="small"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Water"
                />
              </FieldBlock>

              <FieldBlock title="Description">
                <TextField
                  multiline
                  minRows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Write something about this product..."
                />
              </FieldBlock>
            </Box>

            {/* Photos (no preview) */}
            <Box sx={{ display: "grid", gap: 1, alignSelf: "start" }}>
              <Typography sx={{ fontWeight: 950, fontSize: 12.5, letterSpacing: 0.2 }} color="text.secondary">
                Photos
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<ImageOutlinedIcon />}
                  disabled={photoUploading}
                  sx={{ fontWeight: 950, borderRadius: 1 }}
                >
                  {photoUploading ? 'Uploading...' : 'Choose photo'}
                  <input hidden type="file" accept="image/*" onChange={handleChoosePhoto} />
                </Button>

                {/* show filename or preview thumbnail */}
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid #e0e0e0' }} />
                ) : photoName ? (
                  <Typography sx={{ fontWeight: 900, fontSize: 13 }} color="text.secondary">
                    {photoName}
                  </Typography>
                ) : null}
              </Box>
            </Box>



          </Box>
        </Section>

        {/* PRICING */}
        <Section title="Pricing">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <FieldBlock title="Base Price">
              <TextField
                size="small"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="500"
                type="number"
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

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <FieldBlock title="Discount">
                <TextField
                  size="small"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  type="number"
                />
              </FieldBlock>

              <FieldBlock title="Discount type">
                <FormControl fullWidth size="small">
                  <Select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    sx={{ fontWeight: 900 }}
                  >
                    <MenuItem value="Almost Expired/ Open Box">Almost Expired</MenuItem>
                    <MenuItem value="Promo">Promo</MenuItem>
                    <MenuItem value="Staff Discount">Staff Discount</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                </FormControl>
              </FieldBlock>
            </Box>

            <FieldBlock title="Category">
              <FormControl fullWidth size="small">
                <Select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  sx={{ fontWeight: 900 }}
                >
                  {(categories || []).map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                  {(!categories || categories.length === 0) && (
                    <MenuItem value="" disabled>
                      No categories yet — add one first
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </FieldBlock>

            <FieldBlock title="Qty of Products">
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2.5,
                  overflow: "hidden",
                  width: "fit-content",
                  bgcolor: "background.paper",
                }}
              >
                <IconButton size="small" onClick={decQty} sx={{ borderRadius: 0 }}>
                  <RemoveRoundedIcon fontSize="small" />
                </IconButton>

                <Box
                  sx={{
                    minWidth: 64,
                    px: 2,
                    py: 0.9,
                    textAlign: "center",
                    fontWeight: 950,
                    borderLeft: "1px solid",
                    borderRight: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  {qty}
                </Box>

                <IconButton size="small" onClick={incQty} sx={{ borderRadius: 0 }}>
                  <AddRoundedIcon fontSize="small" />
                </IconButton>
              </Box>
            </FieldBlock>
          </Box>
        </Section>

        {/* Bottom button like wireframe */}
        <Box sx={{ display: "flex", justifyContent: "center", pt: 0.5 }}>
          <Button
            variant="contained"
            disabled={!canSave}
            onClick={() => {
              const payload = {
                name: String(name).trim(),
                description: String(description).trim(),
                basePrice: Number(basePrice || 0),
                discount: Number(discount || 0),
                discountType,
                categoryId,
                qty: Number(qty || 0),
                photoName: photoName || null,
                photoDataUrl: photoDataUrl || null,
              };
              onSave?.(payload);
            }}
            sx={{ fontWeight: 950, px: 4, py: 1.2, borderRadius: 2.5 }}
          >
            {mode === "edit" ? "Save Product" : "Create Product"}
          </Button>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ fontWeight: 900 }}>
          Close
        </Button>
      </DialogActions>
    </GemDialog>
  );
}
