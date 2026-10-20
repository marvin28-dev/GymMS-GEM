import useLiveRefresh from '../hooks/useLiveRefresh';
import PriceTag from '../components/ui/PriceTag';
import { saleUnitPrice, profitPerItem, marginPct, profitOf } from '../utils/productPrice';
import { useState, useEffect } from 'react';
import { formatMoney } from '../utils/currency';
import { useLanguage } from '../contexts/LanguageContext';
import { fmtDate, fmtTime, dayStr, todayStr } from '../utils/date';
import DayStepper from '../components/ui/DayStepper';
import {
  ShoppingBag,
  Banknote,
  TrendingUp,
  Package,
  Pencil,
  RotateCcw,
  Tag,
  Plus,
  Trash2,
} from 'lucide-react';
import RowMenu from '../components/ui/RowMenu';
import { useIsMobile } from '../hooks/useIsMobile';
import FAB from '../components/FAB';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import ManagerAuthModal from '../components/ui/ManagerAuthModal';
import GemInput from '../components/ui/GemInput';
import GemSelect from '../components/ui/GemSelect';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import { getAll as getProducts, create as createProduct, update as updateProduct, remove as removeProduct, restock as restockProduct } from '../services/products.service';
import { getAll as getSales, create as createSale } from '../services/sales.service';
import { SkeletonCards, SkeletonTableRows } from '../components/Skeleton';
import { gymCache } from '../utils/gymCache';
import { useGymSettings, legacyList } from '../hooks/useGymSettings';
import { setProductCategories as saveProductCategories } from '../services/gym.service';
import { enabledMethods, PAYMENT_METHODS, canonicalMethod } from '../utils/paymentMethods';
import { suggestProductCode } from '../utils/productCode';
import { digitsOnly } from '../utils/number';

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

// The stored method ('cash', 'mobile_money') as the gym's own label key
const methodKey = (m) => PAYMENT_METHODS.find(x => x.api === m || x.key === canonicalMethod(m))?.key || m;

// A sale with every line on it, not just the first
function mapSale(s) {
  const items = s.items || [];
  return {
    id: s.id,
    date: fmtDate(s.createdAt),
    time: fmtTime(s.createdAt),
    // Names only: the quantity has its own column, and "400× Water" read as one word
    product: [...new Set(items.map(i => i.product?.name).filter(Boolean))].join(', ') || '-',
    qty: items.reduce((n, i) => n + (i.quantity || 0), 0),
    amount: formatMoney(s.total),
    method: methodKey(s.method),
    createdAt: s.createdAt,
    total: s.total,
    items,
  };
}

// Stock at or below this reads as low unless the product sets its own level
const DEFAULT_REORDER = 5;
const isLow = (p) => (p.stock ?? 0) <= (p.reorderLevel ?? DEFAULT_REORDER);
const sellable = (p) => p.isActive !== false && (p.stock ?? 0) > 0;

const emptyProductForm = {
  name: '', code: '', category: 'Supplements', description: '',
  costPrice: '', price: '', discountPercent: '', quantity: '', reorderLevel: '',
  status: 'active',
};

function MethodPill({ method }) {
  const { t } = useLanguage();
  const styles = {
    Cash: { background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)' },
    'Credit/Debit Card': { background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
    'Bank Transfer': { background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' },
    'Mobile Money': { background: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
  };
  const s = styles[method] || styles.Cash;
  const label = PAYMENT_METHODS.find(m => m.key === method);
  return (
    <span style={{ ...s, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500, fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}>
      {label ? t(label.labelKey) : method}
    </span>
  );
}

// Profit on one item in a product list: the amount and its share of the price
function ProfitCell({ product, small }) {
  const { t } = useLanguage();
  const profit = profitPerItem(product), pct = marginPct(product);
  if (profit == null) return <span style={{ fontSize: small ? 11 : 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('sales.noCost')}</span>;
  return (
    <span style={{ fontSize: small ? 11.5 : 13, fontWeight: 600, fontFamily: 'DM Sans', color: profit < 0 ? 'var(--accent-red)' : 'var(--accent-green)', whiteSpace: 'nowrap' }}>
      {small ? `${t('sales.profit')} ` : ''}{formatMoney(profit)}
      {pct != null && <span style={{ fontSize: small ? 10.5 : 11, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>{pct}%</span>}
    </span>
  );
}

// What one item leaves the gym once its cost is paid, worked out live while
// the prices are typed. A loss shows in red; no cost price yet asks for one.
function ProfitLine({ form, editing }) {
  const { t } = useLanguage();
  const hasCost = form.costPrice !== '' && form.costPrice != null;
  if (!hasCost) {
    return editing ? <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('sales.noCostYet')}</div> : null;
  }
  if (!(Number(form.price) > 0)) return null;
  const item = { price: form.price, discountPercent: form.discountPercent, costPrice: form.costPrice };
  const profit = profitPerItem(item), pct = marginPct(item);
  const loss = profit < 0;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{loss ? t('sales.lossPerItem') : t('sales.profitPerItem')}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: loss ? 'var(--accent-red)' : 'var(--accent-green)' }}>
        {formatMoney(Math.abs(profit))}
        {pct != null && <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>{t('sales.marginOf', { pct })}</span>}
      </span>
    </div>
  );
}

// Adding or editing a product. The code is required; while the staff haven't
// typed one, it follows the name as a suggestion they can keep or change.
function AddProductModal({ open, onClose, onSave, initial, categories, takenCodes }) {
  const { t } = useLanguage();
  const editing = !!initial?.id;
  const [form, setForm] = useState(() => ({ ...emptyProductForm, ...(initial || {}), code: initial?.code || '' }));
  const [codeTouched, setCodeTouched] = useState(editing);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  const onName = (v) => {
    setErrors(e => ({ ...e, name: undefined, code: undefined }));
    setForm(f => ({ ...f, name: v, ...(codeTouched ? {} : { code: v.trim() ? suggestProductCode(v, takenCodes) : '' }) }));
  };

  const handleClose = () => {
    onClose();
    setForm(emptyProductForm); setErrors({}); setApiError(''); setCodeTouched(false);
  };

  const handleSave = async () => {
    const e = {};
    if (!form.name.trim()) e.name = t('common.required');
    if (!form.code.trim()) e.code = t('common.required');
    else if (takenCodes.includes(form.code.trim().toUpperCase())) e.code = t('sales.codeTaken');
    if (!editing && (form.costPrice === '' || form.costPrice == null)) e.costPrice = t('sales.costRequired');
    if (!(Number(form.price) > 0)) e.price = t('sales.priceRequired');
    if (form.discountPercent !== '' && form.discountPercent != null && !(Number(form.discountPercent) >= 1 && Number(form.discountPercent) <= 99)) e.discountPercent = t('sales.discountRange');
    if (!editing && form.quantity === '') e.quantity = t('common.required');
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiError('');
    const err = await onSave(form);
    setSaving(false);
    if (err) { setApiError(err); return; }
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={editing ? t('sales.editProduct') : t('sales.addProduct')} maxWidth={580}>
      <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <GemInput label={t('sales.productName')} required error={errors.name} value={form.name} onChange={e => onName(e.target.value)} placeholder={t('sales.productNamePh')} />
        </div>
        <div>
          <GemInput label={t('sales.productCode')} required error={errors.code} value={form.code}
            onChange={e => { setCodeTouched(true); set('code', e.target.value.toUpperCase().replace(/\s+/g, '-')); }}
            placeholder="WHEP-001" />
          {!codeTouched && form.code && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'DM Sans' }}>{t('sales.codeSuggested')}</div>}
        </div>
        <GemSelect
          label={t('sales.category')}
          value={form.category}
          onChange={e => set('category', e.target.value)}
          options={(categories || []).map(c => ({ value: c, label: c }))}
        />
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('common.description')}</label>
          <textarea
            value={form.description || ''}
            onChange={e => set('description', e.target.value)}
            rows={2}
            placeholder={t('sales.descriptionPh')}
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
        <GemInput label={t('sales.costPrice')} required={!editing} error={errors.costPrice} type="text" inputMode="numeric" value={form.costPrice ?? ''} onChange={e => set('costPrice', digitsOnly(e.target.value))} placeholder="0" />
        <GemInput label={t('sales.sellingPrice')} required error={errors.price} type="text" inputMode="numeric" value={form.price ?? ''} onChange={e => set('price', digitsOnly(e.target.value))} placeholder="0" />
        <div style={{ gridColumn: '1 / -1' }}><ProfitLine form={form} editing={editing} /></div>
        <div>
          <GemInput label={t('sales.productDiscount')} error={errors.discountPercent} type="text" inputMode="numeric" value={form.discountPercent ?? ''} onChange={e => set('discountPercent', digitsOnly(e.target.value).slice(0, 2))} placeholder="0" />
          {Number(form.discountPercent) > 0 && Number(form.price) > 0 && (
            <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 4, fontFamily: 'DM Sans' }}>{t('sales.sellsAt', { amount: formatMoney(saleUnitPrice({ price: form.price, discountPercent: form.discountPercent })) })}</div>
          )}
        </div>
        <div>
          <GemInput label={t('sales.quantity')} required={!editing} error={errors.quantity} type="text" inputMode="numeric" value={form.quantity ?? ''} onChange={e => set('quantity', digitsOnly(e.target.value))} placeholder="0" readOnly={editing} style={editing ? { opacity: 0.6, cursor: 'not-allowed' } : {}} />
          {editing && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'DM Sans' }}>{t('sales.useRestockHint')}</div>}
        </div>
        <GemInput label={t('sales.reorderLevel')} type="text" inputMode="numeric" value={form.reorderLevel ?? ''} onChange={e => set('reorderLevel', digitsOnly(e.target.value))} placeholder={String(DEFAULT_REORDER)} />
        <GemSelect
          label={t('common.status')}
          value={form.status}
          onChange={e => set('status', e.target.value)}
          options={[{ value: 'active', label: t('common.active') }, { value: 'inactive', label: t('common.inactive') }]}
        />
      </div>
      {apiError && <div style={{ marginTop: 14, fontSize: 12, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '9px 12px' }}>{apiError}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button style={secondaryBtn} onClick={handleClose}>{t('common.cancel')}</button>
        <button style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSave}>{saving ? t('common.saving') : t('sales.saveProduct')}</button>
      </div>
    </Modal>
  );
}

function RestockModal({ open, onClose, product, onRestock }) {
  const { t } = useLanguage();
  const [addQty, setAddQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const n = parseInt(addQty, 10) || 0;

  const handleClose = () => { setAddQty(''); setError(''); onClose(); };
  const handleRestock = async () => {
    if (!(n > 0)) { setError(t('sales.restockQtyRequired')); return; }
    setSaving(true); setError('');
    const err = await onRestock(product.id, n);
    setSaving(false);
    if (err) { setError(err); return; }
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={`${t('sales.restock')}: ${product?.name || ''}`} maxWidth={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <GemInput label={t('sales.addQuantity')} required type="text" inputMode="numeric" value={addQty} error={error || undefined}
          onChange={e => { setAddQty(digitsOnly(e.target.value)); setError(''); }} placeholder={t('common.eg', { x: 50 })} autoFocus />
        {product && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
            {t('sales.currentStock')}: <strong style={{ color: 'var(--text-primary)' }}>{product.stock}</strong>
            {n > 0 && <span> &rarr; <strong style={{ color: 'var(--accent-green)' }}>{product.stock + n}</strong></span>}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
        <button style={secondaryBtn} onClick={handleClose}>{t('common.cancel')}</button>
        <button style={{ ...primaryBtn, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={handleRestock}>{saving ? t('common.saving') : t('sales.confirmRestock')}</button>
      </div>
    </Modal>
  );
}

const CATS_KEY = 'gem_product_categories';
const DEFAULT_CATEGORIES = ['Supplements', 'Accessories', 'Snacks', 'Drinks', 'Equipment'];

export default function SalesPage() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const gymSettings = useGymSettings();
  const methods = enabledMethods(gymSettings);
  // Show the last products and sales at once and refresh quietly; a first-ever
  // visit falls back to the skeleton. See utils/gymCache.js.
  const cache = gymCache('sales');
  const [products, setProducts] = useState(() => cache.read('products', []));
  const [sales, setSales] = useState(() => cache.read('sales', []));
  // The sales list pages back through days; today's list is the one above
  const [histDay, setHistDay] = useState(todayStr);
  const [histList, setHistList] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState('');
  const [saleError, setSaleError] = useState('');
  const [selling, setSelling] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [restockTarget, setRestockTarget] = useState(null);
  // The shop's categories are the gym's (F-127), plus any a product already uses
  const [savedCategories, setSavedCategories] = useState(null);
  const [productCategories, setProductCategories] = useState([]);
  const [categoryError, setCategoryError] = useState('');
  const baseCategories = savedCategories || gymSettings.productCategories || legacyList(CATS_KEY) || DEFAULT_CATEGORIES;
  const categories = [...new Set([...baseCategories, ...productCategories])];
  const saveCategories = async (list) => {
    setCategoryError('');
    try {
      const res = await saveProductCategories(list);
      setSavedCategories(res.data?.productCategories || list);
      return true;
    } catch (err) {
      setCategoryError(err?.response?.data?.error || t('sales.saveFailed'));
      return false;
    }
  };
  const [newCategory, setNewCategory] = useState('');
  const [authPending, setAuthPending] = useState(null);

  // Quick Sale
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState('1');
  const [discount, setDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const [shopLoading, setShopLoading] = useState(() => !cache.has('products'));

  const loadShop = () => {
    getProducts()
      .then(res => {
        const list = res.data || [];
        setProducts(list); cache.write('products', list);
        setProductCategories([...new Set(list.map(p => p.category).filter(Boolean))]);
      })
      .catch(console.error);
    getSales(todayStr())
      .then(res => { const list = (res.data || []).map(mapSale); setSales(list); cache.write('sales', list); })
      .catch(console.error)
      .finally(() => setShopLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadShop(); }, []);
  const loadHist = (day) => {
    setHistLoading(true);
    getSales(day)
      .then(res => setHistList((res.data || []).map(mapSale)))
      .catch(console.error)
      .finally(() => setHistLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (histDay !== todayStr()) loadHist(histDay); }, [histDay]);
  useLiveRefresh(() => { loadShop(); if (histDay !== todayStr()) loadHist(histDay); }, ['sales', 'products']);

  // Only what can actually be sold is offered, and the pick never points at
  // something that ran out or was switched off
  const forSale = products.filter(sellable);
  useEffect(() => {
    if (!forSale.some(p => p.id === selectedProduct)) setSelectedProduct(forSale[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);
  useEffect(() => {
    if (!methods.some(m => m.key === paymentMethod)) setPaymentMethod(methods[0]?.key || 'Cash');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods.length]);

  const currentProduct = forSale.find(p => p.id === selectedProduct);
  const qtyN = parseInt(qty, 10) || 0;
  const discountN = Math.min(100, parseInt(discount, 10) || 0);
  const saleTotal = currentProduct ? Math.round(saleUnitPrice(currentProduct) * qtyN * (1 - discountN / 100)) : 0;
  const qtyProblem = !currentProduct ? '' : qtyN < 1 ? t('sales.qtyAtLeastOne') : qtyN > currentProduct.stock ? t('sales.onlyNLeft', { n: currentProduct.stock }) : '';
  const canSell = !!currentProduct && !qtyProblem && !selling;

  // Today's figures from real sales, on the gym's own calendar day
  const today = todayStr();
  const todaySales = sales.filter(s => dayStr(s.createdAt) === today);
  const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const todayItemsQty = todaySales.reduce((sum, s) => sum + (Number(s.qty) || 0), 0);
  const lowCount = products.filter(p => p.isActive !== false && isLow(p)).length;

  // Cost of each product now, for sales recorded before a sale kept its own cost
  const costNow = Object.fromEntries(products.filter(x => x.costPrice != null).map(x => [x.id, x.costPrice]));
  const todayProfit = profitOf(todaySales, costNow);
  const histIsToday = histDay === today;
  const daySales = histIsToday ? todaySales : histList;
  const dayBusy = !histIsToday && histLoading && !histList.length;
  const dayTotal = daySales.reduce((sum, x) => sum + (Number(x.total) || 0), 0);
  const dayItems = daySales.reduce((sum, x) => sum + (Number(x.qty) || 0), 0);
  const dayProfit = profitOf(daySales, costNow);
  // What the till should hold: the day's takings by how they were paid
  const dayByMethod = PAYMENT_METHODS
    .map(m => ({ key: m.key, label: t(m.labelKey), amount: daySales.filter(x => x.method === m.key).reduce((sum, x) => sum + (Number(x.total) || 0), 0) }))
    .filter(m => m.amount > 0);
  const emptyDayText = histIsToday ? t('sales.noSalesToday') : t('frontDesk.noSalesOnDay');
  const daySummary = (compact) => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: compact ? 8 : 12 }}>
        {[
          [t('frontDesk.salesCount'), daySales.length, 'var(--text-primary)'],
          [t('sales.itemsSold'), dayItems, 'var(--text-primary)'],
          [t('sales.dayTotal'), formatMoney(dayTotal), 'var(--accent-gold)'],
          [t('sales.profit'), formatMoney(dayProfit.profit), dayProfit.profit < 0 ? 'var(--accent-red)' : 'var(--accent-green)'],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: compact ? '9px 11px' : '12px 14px', minWidth: 0 }}>
            <div style={{ fontSize: compact ? 9.5 : 10.5, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{label}</div>
            <div style={{ fontSize: compact ? 14 : 18, fontWeight: 800, color, fontFamily: 'Manrope, sans-serif', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
          </div>
        ))}
      </div>
      {dayProfit.missing > 0 && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 8 }}>{t('sales.profitMissing', { n: dayProfit.missing })}</div>}
      {dayByMethod.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
          <span>{t('sales.paidBy')}</span>
          {dayByMethod.map(m => (
            <span key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <MethodPill method={m.key} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatMoney(m.amount)}</span>
            </span>
          ))}
        </div>
      )}
    </>
  );

  const takenCodes = (exceptId) => products.filter(p => p.id !== exceptId).map(p => String(p.code || '').toUpperCase());

  // Returns an error message, or nothing on success
  const handleSaveProduct = async (form) => {
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      category: form.category,
      price: Number(form.price) || 0,
      discountPercent: form.discountPercent === '' || form.discountPercent == null ? null : Number(form.discountPercent),
      costPrice: form.costPrice === '' ? null : Number(form.costPrice),
      reorderLevel: form.reorderLevel === '' ? null : Number(form.reorderLevel),
      description: form.description || undefined,
      isActive: form.status !== 'inactive',
    };
    try {
      if (form.id) {
        const res = await updateProduct(form.id, payload);
        setProducts(ps => ps.map(p => p.id === form.id ? res.data : p));
      } else {
        const res = await createProduct({ ...payload, stock: Number(form.quantity) || 0 });
        setProducts(ps => [...ps, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setEditProduct(null);
      return null;
    } catch (err) {
      return err?.response?.data?.error || t('sales.saveFailed');
    }
  };

  const handleRestock = async (id, addQty) => {
    try {
      const res = await restockProduct(id, addQty);
      setProducts(ps => ps.map(p => p.id === id ? res.data : p));
      return null;
    } catch (err) {
      return err?.response?.data?.error || t('sales.saveFailed');
    }
  };

  const handleCompleteSale = async () => {
    if (!canSell) return;
    setSaleError(''); setSelling(true);
    try {
      const res = await createSale({
        items: [{ productId: currentProduct.id, quantity: qtyN }],
        discount: discountN,
        method: paymentMethod,
      });
      setSales(prev => [mapSale(res.data), ...prev]);
      if (histDay !== todayStr()) setHistDay(todayStr());
      // The server says what is left, so the shelf count is never guessed
      const left = Object.fromEntries((res.data.stock || []).map(s => [s.id, s.stock]));
      setProducts(ps => ps.map(p => (p.id in left ? { ...p, stock: left[p.id] } : p)));
      setQty('1'); setDiscount('');
      setSaleSuccess(t('sales.saleRecordedAmount', { amount: formatMoney(res.data.total) }));
      setTimeout(() => setSaleSuccess(''), 3000);
    } catch (err) {
      setSaleError(err?.response?.data?.error || t('sales.saleFailed'));
      // Someone else may have sold the last one; show the real stock
      loadShop();
    } finally {
      setSelling(false);
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    if (await saveCategories([...baseCategories, trimmed])) setNewCategory('');
  };

  const handleRemoveCategory = (cat) => {
    if (categories.length <= 1) return;
    setAuthPending({ type: 'category', data: cat });
  };

  const confirmAuth = async () => {
    if (authPending.type === 'product') {
      try {
        const res = await removeProduct(authPending.data.id);
        // A product with sales is kept (inactive) so the history still reads
        if (res.data?.deactivated) setProducts(ps => ps.map(p => p.id === authPending.data.id ? { ...p, isActive: false, status: 'inactive' } : p));
        else setProducts(ps => ps.filter(p => p.id !== authPending.data.id));
      } catch (err) { setSaleError(err?.response?.data?.error || t('sales.saveFailed')); }
    } else {
      await saveCategories(baseCategories.filter(c => c !== authPending.data));
    }
    setAuthPending(null);
  };

  const editItems = (p) => [
    { label: t('common.edit'), icon: <Pencil size={15} />, onClick: () => { setEditProduct({ ...p, price: String(p.price ?? ''), discountPercent: p.discountPercent != null ? String(p.discountPercent) : '', costPrice: p.costPrice != null ? String(p.costPrice) : '', reorderLevel: p.reorderLevel != null ? String(p.reorderLevel) : '', quantity: String(p.stock), status: p.isActive !== false ? 'active' : 'inactive' }); setShowAddProduct(true); } },
    { label: t('sales.restock'), icon: <RotateCcw size={15} />, onClick: () => setRestockTarget(p) },
    { label: t('common.delete'), icon: <Trash2 size={15} />, onClick: () => setAuthPending({ type: 'product', data: p }), danger: true },
  ];

  // The list shows names only; price, offer, code and stock for the chosen one
  // sit on their own line under it. The code is added to a name only where two
  // products share it, so they can still be told apart.
  const sharedNames = new Set(forSale.map(p => p.name).filter((n, i, all) => all.indexOf(n) !== i));
  const productOption = (p) => ({ value: String(p.id), label: sharedNames.has(p.name) ? `${p.name} · ${p.code || '-'}` : p.name });
  const productInfo = currentProduct && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: 'DM Sans', fontSize: 12, color: 'var(--text-muted)' }}>
      {currentProduct.code && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '2px 8px' }}>{currentProduct.code}</span>}
      <PriceTag product={currentProduct} size={13} />
      <span style={{ color: isLow(currentProduct) ? 'var(--accent-red)' : 'var(--text-muted)' }}>{t('sales.nInStock', { n: currentProduct.stock ?? 0 })}</span>
    </div>
  );

  const modals = (
    <>
      {showAddProduct && (
        <AddProductModal
          open={showAddProduct}
          onClose={() => { setShowAddProduct(false); setEditProduct(null); }}
          onSave={handleSaveProduct}
          initial={editProduct}
          categories={categories}
          takenCodes={takenCodes(editProduct?.id)}
          key={editProduct?.id ?? 'new'}
        />
      )}
      {restockTarget && (
        <RestockModal open={!!restockTarget} onClose={() => setRestockTarget(null)} product={restockTarget} onRestock={handleRestock} />
      )}
      <ManagerAuthModal
        open={!!authPending}
        onClose={() => setAuthPending(null)}
        danger
        action={authPending?.type === 'product' ? t('sales.authDeleteProduct', { name: authPending.data?.name || '' }) : t('sales.authRemoveCategory', { name: authPending?.data || '' })}
        onConfirm={confirmAuth}
      />
    </>
  );

  const saleMessages = (
    <>
      {saleError && <div style={{ fontSize: 13, color: 'var(--accent-red)', fontFamily: 'DM Sans', fontWeight: 600 }}>{saleError}</div>}
      {saleSuccess && <div style={{ fontSize: 13, color: 'var(--accent-green)', fontFamily: 'DM Sans', fontWeight: 600 }}>✓ {saleSuccess}</div>}
    </>
  );

  const [mobileTab, setMobileTab] = useState('products');

  if (isMobile) {
    const lbl = { fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: 6 };
    const box = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 12px', fontSize: 16, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };
    return (
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('nav.salesShort')}</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'DM Sans' }}>{t('sales.products')} &middot; {formatMoney(todayRevenue)} {t('common.today').toLowerCase()}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { label: t('sales.todayRevenue'), value: formatMoney(todayRevenue), color: 'var(--accent-blue)', sub: t('frontDesk.nItems', { n: todayItemsQty }) },
            { label: t('sales.profitToday'), value: formatMoney(todayProfit.profit), color: todayProfit.profit < 0 ? 'var(--accent-red)' : 'var(--accent-green)' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: kpi.color, fontFamily: 'JetBrains Mono, monospace' }}>{kpi.value}</div>
              {kpi.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 3 }}>{kpi.sub}</div>}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 10, padding: 3, marginBottom: 14, gap: 3 }}>
          {['products', 'sell', 'history'].map(tab => (
            <button key={tab} onClick={() => setMobileTab(tab)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12, fontWeight: mobileTab === tab ? 600 : 400, background: mobileTab === tab ? 'var(--bg-card)' : 'transparent', color: mobileTab === tab ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
              {tab === 'products' ? t('sales.products') : tab === 'sell' ? t('sales.quickSale') : t('sales.history')}
            </button>
          ))}
        </div>

        {mobileTab === 'products' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
            {shopLoading ? (
              <SkeletonCards count={4} />
            ) : products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>{t('sales.noProductsYet')}</div>
            ) : products.map(p => (
              <div key={p.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: p.isActive === false ? 0.6 : 1 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Package size={18} color="var(--accent-gold)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{p.code}</span>
                    <PriceTag product={p} />
                    <ProfitCell product={p} small />
                    <span style={{ fontSize: 11, color: isLow(p) ? 'var(--accent-red)' : 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('sales.stockLabel')}: {p.stock ?? 0}</span>
                  </div>
                </div>
                <RowMenu title={t('common.actions')} items={editItems(p)} />
              </div>
            ))}
          </div>
        )}

        {mobileTab === 'sell' && (
          <div style={{ paddingBottom: 16 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '16px' }}>
              {forSale.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'center', padding: '20px 0' }}>{t('sales.nothingToSell')}</div>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>{t('sales.product')} *</label>
                    <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} style={box}>
                      {forSale.map(p => { const o = productOption(p); return <option key={o.value} value={o.value}>{o.label}</option>; })}
                    </select>
                    {productInfo && <div style={{ marginTop: 8 }}>{productInfo}</div>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={lbl}>{t('sales.qty')} *</label>
                      <input type="text" inputMode="numeric" value={qty} onChange={e => setQty(digitsOnly(e.target.value))} style={box} />
                    </div>
                    <div>
                      <label style={lbl}>{t('sales.discount')}</label>
                      <input type="text" inputMode="numeric" value={discount} onChange={e => setDiscount(digitsOnly(e.target.value).slice(0, 3))} placeholder="0" style={box} />
                    </div>
                  </div>
                  {qtyProblem && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginBottom: 10, fontFamily: 'DM Sans' }}>{qtyProblem}</div>}
                  <div style={{ marginBottom: 14 }}>
                    <label style={lbl}>{t('sales.paymentMethod')}</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {methods.map(m => {
                        const active = paymentMethod === m.key;
                        return (
                          <button key={m.key} onClick={() => setPaymentMethod(m.key)} style={{ padding: '7px 13px', borderRadius: 8, border: `1px solid ${active ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: active ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)', color: active ? 'var(--accent-gold)' : 'var(--text-muted)', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'DM Sans' }}>{t(m.labelKey)}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('sales.total')}</span>
                      <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace' }}>{formatMoney(saleTotal)}</span>
                    </div>
                    <div style={{ marginBottom: 8 }}>{saleMessages}</div>
                    <button onClick={handleCompleteSale} disabled={!canSell} style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: canSell ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans', opacity: canSell ? 1 : 0.5 }}>
                      {selling ? t('common.saving') : t('sales.completeSale')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {mobileTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><DayStepper day={histDay} onChange={setHistDay} size="md" /></div>
              {daySummary(true)}
            </div>
            {(histIsToday ? shopLoading : dayBusy) ? (
              <SkeletonCards count={3} />
            ) : daySales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>{emptyDayText}</div>
            ) : daySales.map(s => (
              <div key={s.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{s.product}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                    <MethodPill method={s.method} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('frontDesk.nItems', { n: s.qty })} · {s.time}</span>
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>{s.amount}</div>
              </div>
            ))}
          </div>
        )}

        {mobileTab === 'products' && <FAB onClick={() => { setEditProduct(null); setShowAddProduct(true); }} label={t('sales.addProduct')} />}
        {modals}
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <PageHeader title={t('sales.title')} subtitle={t('sales.products')}>
        <button style={primaryBtn} onClick={() => { setEditProduct(null); setShowAddProduct(true); }}>+ {t('sales.addProduct')}</button>
      </PageHeader>

      <div className="gem-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('sales.todayRevenue'), value: formatMoney(todayRevenue), icon: Banknote, accent: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)' },
          { label: t('sales.profitToday'), value: formatMoney(todayProfit.profit), icon: TrendingUp, accent: todayProfit.profit < 0 ? 'var(--accent-red)' : 'var(--accent-green)', dim: todayProfit.profit < 0 ? 'var(--accent-red-dim)' : 'var(--accent-green-dim)' },
          { label: t('sales.itemsSoldToday'), value: String(todayItemsQty), icon: ShoppingBag, accent: 'var(--accent-gold)', dim: 'var(--accent-gold-dim)' },
          { label: t('sales.totalProducts'), value: String(products.length), icon: Package, accent: 'var(--accent-green)', dim: 'var(--accent-green-dim)' },
          { label: t('sales.lowStockCount'), value: String(lowCount), icon: RotateCcw, accent: lowCount ? 'var(--accent-red)' : 'var(--accent-green)', dim: lowCount ? 'var(--accent-red-dim)' : 'var(--accent-green-dim)' },
        ].map(({ label, value, icon: Icon, accent, dim }) => (
          <div key={label} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: dim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color={accent} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Sale */}
      <div style={{ ...card, padding: 24, marginBottom: 24 }}>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>{t('sales.quickSale')}</div>
        {forSale.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('sales.nothingToSell')}</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2.2fr) repeat(4, minmax(0, 1fr))', gap: 14, alignItems: 'end' }} className="gem-two-col">
              <GemSelect label={t('sales.product')} required value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} options={forSale.map(productOption)} />
              <GemInput label={t('sales.quantity')} required type="text" inputMode="numeric" value={qty} onChange={e => setQty(digitsOnly(e.target.value))} error={qtyProblem || undefined} />
              <GemInput label={t('sales.discount')} type="text" inputMode="numeric" value={discount} onChange={e => setDiscount(digitsOnly(e.target.value).slice(0, 3))} placeholder="0" />
              <GemSelect label={t('sales.paymentMethod')} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} options={methods.map(m => ({ value: m.key, label: t(m.labelKey) }))} />
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('sales.total')}</label>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 14px', fontSize: 14, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: 'Manrope, sans-serif' }}>
                  {formatMoney(saleTotal)}
                </div>
              </div>
            </div>
            {productInfo && <div style={{ marginTop: 10 }}>{productInfo}</div>}
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <button style={{ ...primaryBtn, padding: '10px 28px', fontSize: 13, opacity: canSell ? 1 : 0.5, cursor: canSell ? 'pointer' : 'not-allowed' }} onClick={handleCompleteSale} disabled={!canSell}>
                {selling ? t('common.saving') : t('sales.completeSale')}
              </button>
              {saleMessages}
            </div>
          </>
        )}
      </div>

      {/* Products Table */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('sales.products')}</span>
        </div>
        <div className="gem-table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[t('sales.productName'), t('sales.productCode'), t('sales.category'), t('packages.price'), t('sales.profitCol'), t('sales.qty'), t('common.status'), t('common.actions')].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shopLoading ? (
                <SkeletonTableRows rows={4} cols={8} />
              ) : products.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={Package} title={t('sales.noProducts')} message={t('sales.addFirstProductMsg')} /></td></tr>
              ) : products.map(p => (
                <tr key={p.id} style={{ transition: 'background 0.15s', opacity: p.isActive === false ? 0.6 : 1 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{p.code || '-'}</td>
                  <td style={tdStyle}>{p.category}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}><PriceTag product={p} /></td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}><ProfitCell product={p} /></td>
                  <td style={{ ...tdStyle, color: isLow(p) ? 'var(--accent-red)' : 'var(--text-primary)', fontWeight: isLow(p) ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {p.stock}
                    {isLow(p) && <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--accent-red)' }}>{p.stock > 0 ? t('sales.lowStock') : t('sales.outOfStock')}</span>}
                  </td>
                  <td style={tdStyle}><StatusBadge status={p.isActive !== false ? 'active' : 'inactive'} /></td>
                  <td style={tdStyle}><RowMenu title={t('common.actions')} items={editItems(p)} /></td>
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
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontFamily: 'DM Sans', color: 'var(--text-primary)', fontWeight: 500 }}>
              {cat}
              <button
                title={categories.length <= 1 ? t('sales.lastCategory') : t('sales.removeCategory', { name: cat })}
                onClick={() => handleRemoveCategory(cat)}
                disabled={categories.length <= 1}
                style={{ background: 'none', border: 'none', cursor: categories.length <= 1 ? 'not-allowed' : 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: categories.length <= 1 ? 'var(--text-muted)' : 'var(--text-secondary)', fontSize: 14, lineHeight: 1, opacity: categories.length <= 1 ? 0.4 : 1 }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 360 }}>
          <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCategory()} placeholder={t('sales.newCategoryPlaceholder')}
            style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' }} />
          <button style={{ ...primaryBtn, display: 'flex', alignItems: 'center', gap: 4 }} onClick={handleAddCategory}>
            <Plus size={13} />
            {t('common.add')}
          </button>
        </div>
        {categoryError && <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{categoryError}</div>}
      </div>

      {/* Sales, one day at a time */}
      <div style={card}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('sales.salesHistory')}</span>
            <DayStepper day={histDay} onChange={setHistDay} size="md" />
          </div>
          {daySummary(false)}
        </div>
        <div className="gem-table-scroll" style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[t('sales.time'), t('sales.product'), t('sales.qty'), t('common.amount'), t('payments.method')].map(h => (
                  <th key={h} style={{ ...thStyle, position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-card)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(histIsToday ? shopLoading : dayBusy) ? (
                <SkeletonTableRows rows={3} cols={5} />
              ) : daySales.length === 0 ? (
                <tr><td colSpan={5}><EmptyState icon={ShoppingBag} title={emptyDayText} message={histIsToday ? t('sales.noSalesMsgDesktop') : ''} /></td></tr>
              ) : daySales.map((s) => (
                <tr key={s.id}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace' }}>{s.time}</td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{s.product}</td>
                  <td style={tdStyle}>{s.qty}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--accent-green)', whiteSpace: 'nowrap' }}>{s.amount}</td>
                  <td style={tdStyle}><MethodPill method={s.method} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modals}
    </div>
  );
}
