import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  ShoppingBag,
  Banknote,
  Package,
  Pencil,
  TrendingUp,
  RotateCcw,
  Tag,
  Plus,
  Trash2,
} from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import GemInput from '../components/ui/GemInput';
import GemSelect from '../components/ui/GemSelect';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import { getAll as getProducts, create as createProduct, update as updateProduct, remove as removeProduct } from '../services/products.service';
import { getAll as getSales, create as createSale } from '../services/sales.service';

const primaryBtn = {
  background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
  color: '#0a0a0f',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'DM Sans',
};
const secondaryBtn = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'DM Sans',
};
const card = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-card)',
};

const thStyle = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  fontFamily: 'DM Sans, sans-serif',
  borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '11px 14px',
  fontSize: 13,
  color: 'var(--text-primary)',
  fontFamily: 'DM Sans, sans-serif',
  borderBottom: '1px solid var(--border-subtle)',
};

const DB_METHOD_LABEL = { cash: 'Cash', card: 'Card', bank_transfer: 'Transfer', mobile_money: 'Mobile Money' };

function mapSale(s) {
  const item = s.items?.[0];
  return {
    id: s.id,
    date: new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    product: item?.product?.name || '—',
    qty: String(item?.quantity || ''),
    amount: `${Math.round(s.total).toLocaleString('fr-FR')} FCFA`,
    method: DB_METHOD_LABEL[s.method] || s.method,
    createdAt: s.createdAt,
    total: s.total,
  };
}

const emptyProductForm = {
  name: '', code: '', category: 'Supplements', description: '',
  costPrice: '', price: '', quantity: '', reorderLevel: '',
  status: 'active', notes: '',
};

function MethodPill({ method }) {
  const styles = {
    Cash: { background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)' },
    Card: { background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
    Transfer: { background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' },
  };
  const s = styles[method] || styles.Cash;
  return (
    <span style={{ ...s, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, fontFamily: 'DM Sans' }}>
      {method}
    </span>
  );
}

function AddProductModal({ open, onClose, onSave, initial, categories }) {
  const [form, setForm] = useState(initial || emptyProductForm);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name || !form.price || !form.quantity) return;
    onSave(form);
    onClose();
    setForm(emptyProductForm);
  };

  const handleClose = () => {
    onClose();
    setForm(emptyProductForm);
  };

  return (
    <Modal open={open} onClose={handleClose} title={initial?.id ? 'Edit Product' : 'Add Product'} maxWidth={580}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <GemInput label="Product Name *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Whey Protein (1kg)" />
        </div>
        <GemInput label="Product Code" value={form.code} onChange={e => set('code', e.target.value)} placeholder="PRD-001" />
        <GemSelect
          label="Category"
          value={form.category}
          onChange={e => set('category', e.target.value)}
          options={(categories || []).map(c => ({ value: c, label: c }))}
        />
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>Description</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={2}
            placeholder="Brief description..."
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
        <GemInput label="Cost Price" type="number" value={form.costPrice} onChange={e => set('costPrice', e.target.value)} placeholder="0.00" />
        <GemInput label="Selling Price *" type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
        <div>
          <GemInput label="Quantity *" type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="0" readOnly={!!initial?.id} style={initial?.id ? { opacity: 0.6, cursor: 'not-allowed' } : {}} />
          {initial?.id && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'DM Sans' }}>Use Restock to update quantity</div>}
        </div>
        <GemInput label="Reorder Level" type="number" value={form.reorderLevel} onChange={e => set('reorderLevel', e.target.value)} placeholder="10" />
        <GemSelect
          label="Status"
          value={form.status}
          onChange={e => set('status', e.target.value)}
          options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
        />
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>Notes</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={2}
            placeholder="Any additional notes..."
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button style={secondaryBtn} onClick={handleClose}>Cancel</button>
        <button style={primaryBtn} onClick={handleSave}>Save Product</button>
      </div>
    </Modal>
  );
}

function RestockModal({ open, onClose, product, onRestock }) {
  const [addQty, setAddQty] = useState('');
  const [notes, setNotes] = useState('');

  const handleRestock = () => {
    const qty = parseInt(addQty);
    if (!qty || qty <= 0) return;
    onRestock(product.id, qty);
    setAddQty('');
    setNotes('');
    onClose();
  };

  const handleClose = () => {
    setAddQty('');
    setNotes('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={`Restock: ${product?.name || ''}`} maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GemInput
          label="Add Quantity *"
          type="number"
          min="1"
          value={addQty}
          onChange={e => setAddQty(e.target.value)}
          placeholder="e.g. 50"
        />
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Restock notes (supplier, batch, etc.)..."
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
        {product && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
            Current stock: <strong style={{ color: 'var(--text-primary)' }}>{product.stock}</strong>
            {addQty && parseInt(addQty) > 0 && (
              <span> &rarr; <strong style={{ color: 'var(--accent-green)' }}>{product.stock + (parseInt(addQty) || 0)}</strong></span>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button style={secondaryBtn} onClick={handleClose}>Cancel</button>
        <button style={primaryBtn} onClick={handleRestock}>Confirm Restock</button>
      </div>
    </Modal>
  );
}

const CATS_KEY = 'gem_product_categories';
const DEFAULT_CATEGORIES = ['Supplements', 'Accessories', 'Snacks', 'Drinks', 'Equipment'];

export default function SalesPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [saleSuccess, setSaleSuccess] = useState(false);
  const [saleError, setSaleError] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [restockTarget, setRestockTarget] = useState(null);
  const [categories, setCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CATS_KEY) || 'null') || DEFAULT_CATEGORIES; } catch { return DEFAULT_CATEGORIES; }
  });
  const [newCategory, setNewCategory] = useState('');
  const [authPending, setAuthPending] = useState(null);

  useEffect(() => {
    localStorage.setItem(CATS_KEY, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    getProducts()
      .then(res => {
        const list = res.data || [];
        setProducts(list);
        if (list.length) setSelectedProduct(list[0].id);
        const cats = [...new Set(list.map(p => p.category).filter(Boolean))];
        if (cats.length) setCategories(prev => [...new Set([...prev, ...cats])]);
      })
      .catch(console.error);
    getSales()
      .then(res => setSales((res.data || []).map(mapSale)))
      .catch(console.error);
  }, []);

  // Quick Sale state
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const currentProduct = products.find(p => p.id === selectedProduct);
  const saleTotal = currentProduct
    ? (currentProduct.price * qty * (1 - (parseFloat(discount) || 0) / 100)).toFixed(2)
    : '0.00';

  // Compute today's stats from real sales
  const todayStr = new Date().toDateString();
  const todaySales = sales.filter(s => new Date(s.createdAt).toDateString() === todayStr);
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const todayItemsQty = todaySales.reduce((sum, s) => sum + (parseInt(s.qty) || 0), 0);

  const handleSaveProduct = async (form) => {
    const payload = {
      name: form.name,
      category: form.category,
      price: parseFloat(form.price) || 0,
      stock: parseInt(form.quantity) || 0,
      description: form.description || undefined,
      isActive: form.status !== 'inactive',
    };
    try {
      if (form.id) {
        const { stock: _s, ...updatePayload } = payload;
        const res = await updateProduct(form.id, updatePayload);
        setProducts(ps => ps.map(p => p.id === form.id ? res.data : p));
      } else {
        const res = await createProduct(payload);
        setProducts(ps => [...ps, res.data]);
        setSelectedProduct(prev => prev || res.data.id);
      }
      setEditProduct(null);
    } catch (err) { console.error(err); }
  };

  const handleRestock = async (id, addQty) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    try {
      const res = await updateProduct(id, { stock: product.stock + addQty });
      setProducts(ps => ps.map(p => p.id === id ? res.data : p));
    } catch (err) { console.error(err); }
  };

  const handleCompleteSale = async () => {
    if (!currentProduct) return;
    setSaleError('');
    try {
      const res = await createSale({
        productId: selectedProduct,
        quantity: qty,
        discount,
        method: paymentMethod,
      });
      const newSale = mapSale(res.data);
      setSales(prev => [newSale, ...prev]);
      // Decrement stock in product list
      setProducts(ps => ps.map(p =>
        p.id === selectedProduct ? { ...p, stock: p.stock - qty } : p
      ));
      setQty(1);
      setDiscount(0);
      setSaleSuccess(true);
      setTimeout(() => setSaleSuccess(false), 2500);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Sale failed';
      setSaleError(msg);
      setTimeout(() => setSaleError(''), 3000);
    }
  };

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    setCategories(cs => [...cs, trimmed]);
    setNewCategory('');
  };

  const handleRemoveCategory = (cat) => {
    if (categories.length <= 1) return;
    setAuthPending({ type: 'category', data: cat });
  };

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <PageHeader title={t('sales.title')} subtitle={t('sales.products')}>
        <button style={primaryBtn} onClick={() => { setEditProduct(null); setShowAddProduct(true); }}>+ {t('sales.addProduct')}</button>
      </PageHeader>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('sales.todayRevenue'), value: `${Math.round(todayRevenue).toLocaleString('fr-FR')} FCFA`, icon: Banknote, accent: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)' },
          { label: t('sales.itemsSoldToday'), value: String(todayItemsQty), icon: ShoppingBag, accent: 'var(--accent-gold)', dim: 'var(--accent-gold-dim)' },
          { label: t('sales.totalProducts'), value: String(products.length), icon: Package, accent: 'var(--accent-green)', dim: 'var(--accent-green-dim)' },
        ].map(({ label, value, icon: Icon, accent, dim }) => (
          <div key={label} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: dim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color={accent} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Sale */}
      <div style={{ ...card, padding: 24, marginBottom: 24 }}>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>{t('sales.quickSale')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 14, alignItems: 'end' }}>
          <GemSelect
            label="Product"
            value={selectedProduct}
            onChange={e => setSelectedProduct(e.target.value)}
            options={products.map(p => ({ value: String(p.id), label: `${p.name} — ${Math.round(p.price).toLocaleString('fr-FR')} FCFA` }))}
          />
          <GemInput label="Quantity" type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
          <GemInput label="Discount (%)" type="number" min="0" max="100" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" />
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>Total</label>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 14, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'Manrope, sans-serif' }}>
              {Math.round(saleTotal).toLocaleString('fr-FR')} FCFA
            </div>
          </div>
          <GemSelect
            label="Payment Method"
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value)}
            options={['Cash', 'Card', 'Transfer'].map(m => ({ value: m, label: m }))}
          />
        </div>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            style={{ ...primaryBtn, padding: '10px 28px', fontSize: 13, opacity: !currentProduct ? 0.5 : 1 }}
            onClick={handleCompleteSale}
            disabled={!currentProduct}
          >
            {t('sales.completeSale')}
          </button>
          {saleSuccess && <span style={{ fontSize: 13, color: 'var(--accent-green)', fontFamily: 'DM Sans', fontWeight: 600 }}>{t('sales.saleRecorded')}</span>}
          {saleError && <span style={{ fontSize: 13, color: 'var(--accent-red)', fontFamily: 'DM Sans', fontWeight: 600 }}>{saleError}</span>}
        </div>
      </div>

      {/* Products Table */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('sales.products')}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[t('sales.productName'), 'Code', t('sales.category'), t('packages.price'), t('sales.qty'), t('common.status'), t('common.actions')].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={Package} title="No products" message="Add your first product to get started." /></td></tr>
              ) : products.map(p => (
                <tr key={p.id} style={{ transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{p.code}</td>
                  <td style={tdStyle}>{p.category}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--accent-gold)' }}>{Math.round(p.price).toLocaleString('fr-FR')} FCFA</td>
                  <td style={{ ...tdStyle, color: p.stock < 10 ? 'var(--accent-red)' : 'var(--text-primary)', fontWeight: p.stock < 10 ? 600 : 400 }}>
                    {p.stock}
                    {p.stock < 10 && <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--accent-red)' }}>Low</span>}
                  </td>
                  <td style={tdStyle}><StatusBadge status={p.isActive !== false ? 'active' : 'inactive'} /></td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        title="Edit"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onClick={() => { setEditProduct({ ...p, quantity: String(p.stock), status: p.isActive !== false ? 'active' : 'inactive' }); setShowAddProduct(true); }}
                      >
                        <Pencil size={13} color="var(--text-secondary)" />
                      </button>
                      <button
                        title="Restock"
                        style={{ background: 'var(--accent-green-dim)', border: '1px solid transparent', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onClick={() => setRestockTarget(p)}
                      >
                        <RotateCcw size={13} color="var(--accent-green)" />
                      </button>
                      <button
                        title="Delete"
                        style={{ background: 'var(--accent-red-dim)', border: '1px solid transparent', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onClick={() => setAuthPending({ type: 'product', data: p })}
                      >
                        <Trash2 size={13} color="var(--accent-red)" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Categories */}
      <div style={{ ...card, marginBottom: 24, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Tag size={16} color="var(--accent-gold)" />
          <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('sales.productCategories')}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {categories.map(cat => (
            <div
              key={cat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 20,
                padding: '5px 12px',
                fontSize: 12,
                fontFamily: 'DM Sans',
                color: 'var(--text-primary)',
                fontWeight: 500,
              }}
            >
              {cat}
              <button
                title={categories.length <= 1 ? 'Cannot remove last category' : `Remove ${cat}`}
                onClick={() => handleRemoveCategory(cat)}
                disabled={categories.length <= 1}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: categories.length <= 1 ? 'not-allowed' : 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  color: categories.length <= 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                  fontSize: 14,
                  lineHeight: 1,
                  opacity: categories.length <= 1 ? 0.4 : 1,
                }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 360 }}>
          <input
            type="text"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
            placeholder="New category name..."
            style={{
              flex: 1,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 13,
              color: 'var(--text-primary)',
              fontFamily: 'DM Sans',
              outline: 'none',
            }}
          />
          <button
            style={{ ...primaryBtn, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={handleAddCategory}
          >
            <Plus size={13} />
            Add
          </button>
        </div>
      </div>

      {/* Recent Sales */}
      <div style={card}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('sales.recentSales')}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[t('common.date'), t('sales.product'), t('sales.qty'), t('common.amount'), t('payments.method')].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr><td colSpan={5}><EmptyState icon={ShoppingBag} title="No sales yet" message="Complete a Quick Sale to see records here." /></td></tr>
              ) : sales.slice(0, 30).map((s) => (
                <tr key={s.id}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 12 }}>{s.date}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{s.product}</td>
                  <td style={tdStyle}>{s.qty}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--accent-green)' }}>{s.amount}</td>
                  <td style={tdStyle}><MethodPill method={s.method} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      <AddProductModal
        open={showAddProduct}
        onClose={() => { setShowAddProduct(false); setEditProduct(null); }}
        onSave={handleSaveProduct}
        initial={editProduct}
        categories={categories}
        key={editProduct?.id ?? 'new'}
      />

      {/* Restock Modal */}
      <RestockModal
        open={!!restockTarget}
        onClose={() => setRestockTarget(null)}
        product={restockTarget}
        onRestock={handleRestock}
      />

      {/* Manager auth — delete product or category */}
      <ManagerAuthModal
        open={!!authPending}
        onClose={() => setAuthPending(null)}
        danger
        action={
          authPending?.type === 'product'
            ? `Delete product "${authPending.data?.name}"`
            : `Remove category "${authPending?.data}"`
        }
        onConfirm={async () => {
          if (authPending.type === 'product') {
            try {
              await removeProduct(authPending.data.id);
              setProducts(ps => ps.filter(p => p.id !== authPending.data.id));
            } catch (err) { console.error(err); }
          } else {
            setCategories(cs => cs.filter(c => c !== authPending.data));
          }
          setAuthPending(null);
        }}
      />
    </div>
  );
}
