// src/pages/Products.jsx
import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  Menu,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";

import GemCard from "../components/ui/GemCard";
import GemTextField from "../components/ui/GemTextField";

import AddProductDialog from "../components/products/AddProductDialog";
import AddCategoryDialog from "../components/products/AddCategoryDialog";
import { defaultProducts, defaultProductCategories } from "../data/mockProducts";

const LS_PRODUCTS = "gem_products_v1";
const LS_CATEGORIES = "gem_product_categories_v1";

function getJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function createId(prefix = "id") {
  return (crypto?.randomUUID?.() || `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`);
}
function money(n) {
  return Number(n || 0).toLocaleString();
}

function RowMenu({ onView, onEdit, onDelete }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onView?.();
          }}
        >
          View
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onEdit?.();
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onDelete?.();
          }}
          sx={{ color: "error.main", fontWeight: 900 }}
        >
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}

export default function Products() {
  const [categories, setCategories] = useState(() => {
    const stored = getJSON(LS_CATEGORIES, null);
    if (Array.isArray(stored) && stored.length) return stored;
    setJSON(LS_CATEGORIES, defaultProductCategories);
    return defaultProductCategories;
  });

  const [products, setProducts] = useState(() => {
    const stored = getJSON(LS_PRODUCTS, null);
    if (Array.isArray(stored) && stored.length) return stored;
    setJSON(LS_PRODUCTS, defaultProducts);
    return defaultProducts;
  });

  const catNameById = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const [tab, setTab] = useState(0);

  // PRODUCTS tab state
  const [search, setSearch] = useState("");
  const [filterBy, setFilterBy] = useState("all"); // all or categoryId

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = products;

    if (filterBy !== "all") rows = rows.filter((p) => p.categoryId === filterBy);
    if (q) rows = rows.filter((p) => (p.name || "").toLowerCase().includes(q));

    return rows;
  }, [products, search, filterBy]);

  // CATEGORY tab state (filter by TYPE like wireframe)
  const [typeFilter, setTypeFilter] = useState("all");

  const typeOptions = useMemo(() => {
    const set = new Set(categories.map((c) => (c.type || "").trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const filteredCategories = useMemo(() => {
    if (typeFilter === "all") return categories;
    return categories.filter((c) => (c.type || "") === typeFilter);
  }, [categories, typeFilter]);

  // dialogs: product
  const [openProduct, setOpenProduct] = useState(false);
  const [productMode, setProductMode] = useState("create");
  const [editingProduct, setEditingProduct] = useState(null);

  // dialogs: category
  const [openCat, setOpenCat] = useState(false);
  const [catMode, setCatMode] = useState("create");
  const [editingCat, setEditingCat] = useState(null);

  const persistProducts = (rows) => {
    setProducts(rows);
    setJSON(LS_PRODUCTS, rows);
  };
  const persistCategories = (rows) => {
    setCategories(rows);
    setJSON(LS_CATEGORIES, rows);
  };

  // products actions
  const handleAddProduct = () => {
    setProductMode("create");
    setEditingProduct(null);
    setOpenProduct(true);
  };
  const handleSaveProduct = (payload) => {
    if (productMode === "edit" && editingProduct?.id) {
      const next = products.map((p) => (p.id === editingProduct.id ? { ...p, ...payload } : p));
      persistProducts(next);
      setOpenProduct(false);
      return;
    }
    persistProducts([{ id: createId("prd"), ...payload }, ...products]);
    setOpenProduct(false);
  };
  const handleDeleteProduct = (row) => {
    if (!row?.id) return;
    persistProducts(products.filter((p) => p.id !== row.id));
  };

  // category actions
  const handleAddCategory = () => {
    setCatMode("create");
    setEditingCat(null);
    setOpenCat(true);
  };
  const handleSaveCategory = (payload) => {
    if (catMode === "edit" && editingCat?.id) {
      const next = categories.map((c) => (c.id === editingCat.id ? { ...c, ...payload } : c));
      persistCategories(next);
      setOpenCat(false);
      return;
    }
    persistCategories([{ id: createId("cat"), ...payload }, ...categories]);
    setOpenCat(false);
  };
  const handleDeleteCategory = (row) => {
    if (!row?.id) return;

    const used = products.some((p) => p.categoryId === row.id);
    if (used) {
      alert("You cannot delete a category that has products. Move/delete products first.");
      return;
    }
    persistCategories(categories.filter((c) => c.id !== row.id));
  };

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 950 }}>
          Products
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View and edit your inventory of products here
        </Typography>
      </Box>

      <GemCard contentSx={{ p: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 2, "& .MuiTab-root": { fontWeight: 950 } }}
        >
          <Tab label="PRODUCTS" />
          <Tab label="CATEGORY" />
        </Tabs>

        {/* ---------------- PRODUCTS TAB ---------------- */}
        {tab === 0 && (
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
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddProduct}
                  sx={{ fontWeight: 950 }}
                >
                  Add a new product
                </Button>

                <Box sx={{ width: { xs: "100%", sm: 280 } }}>
                  <GemTextField
                    placeholder="Search product"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </Box>
              </Box>

              <FormControl size="small" sx={{ width: 220 }}>
                <Select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value)}
                  sx={{ fontWeight: 900 }}
                >
                  <MenuItem value="all">Filter: All</MenuItem>
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      Filter: {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 950 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 950 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 950 }}>Price</TableCell>
                    <TableCell sx={{ fontWeight: 950 }}>Stock</TableCell>
                    <TableCell sx={{ fontWeight: 950 }} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredProducts.map((p) => (
                    <TableRow key={p.id} sx={{ "& td": { borderBottom: "1px solid", borderColor: "divider" } }}>
                      <TableCell sx={{ fontWeight: 900 }}>{p.name}</TableCell>
                      <TableCell>{catNameById.get(p.categoryId) || "—"}</TableCell>
                      <TableCell>{money(p.price)} XAF</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>{p.stock}</TableCell>
                      <TableCell align="right">
                        <RowMenu
                          onView={() =>
                            alert(
                              `Name: ${p.name}\nCategory: ${catNameById.get(p.categoryId) || "—"}\nPrice: ${money(
                                p.price
                              )} XAF\nStock: ${p.stock}`
                            )
                          }
                          onEdit={() => {
                            setProductMode("edit");
                            setEditingProduct(p);
                            setOpenProduct(true);
                          }}
                          onDelete={() => handleDeleteProduct(p)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
                          <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                            No products found.
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <AddProductDialog
              open={openProduct}
              mode={productMode}
              initial={editingProduct}
              categories={categories}
              onClose={() => setOpenProduct(false)}
              onSave={handleSaveProduct}
            />
          </Box>
        )}

        {/* ---------------- CATEGORY TAB (MATCHES WIREFRAME) ---------------- */}
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
                onClick={handleAddCategory}
                sx={{ fontWeight: 950 }}
              >
                Add a new Category
              </Button>

              <FormControl size="small" sx={{ width: 220 }}>
                <Select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  sx={{ fontWeight: 900 }}
                >
                  <MenuItem value="all">Filter by: All</MenuItem>
                  {typeOptions.map((t) => (
                    <MenuItem key={t} value={t}>
                      Filter by: {t}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 950 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 950 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 950 }}>Stock Qty</TableCell>
                    <TableCell sx={{ fontWeight: 950 }} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredCategories.map((c) => (
                    <TableRow key={c.id} sx={{ "& td": { borderBottom: "1px solid", borderColor: "divider" } }}>
                      <TableCell sx={{ fontWeight: 900 }}>{c.name}</TableCell>
                      <TableCell>{c.type || "—"}</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>{Number(c.stockQty || 0).toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <RowMenu
                          onView={() =>
                            alert(
                              `Name: ${c.name}\nType: ${c.type || "—"}\nStock Qty: ${Number(c.stockQty || 0).toLocaleString()}`
                            )
                          }
                          onEdit={() => {
                            setCatMode("edit");
                            setEditingCat(c);
                            setOpenCat(true);
                          }}
                          onDelete={() => handleDeleteCategory(c)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredCategories.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
                          <Typography sx={{ fontWeight: 900 }} color="text.secondary">
                            No categories found.
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <AddCategoryDialog
              open={openCat}
              mode={catMode}
              initial={editingCat}
              onClose={() => setOpenCat(false)}
              onSave={handleSaveCategory}
            />
          </Box>
        )}
      </GemCard>
    </Box>
  );
}
