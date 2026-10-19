import { formatMoney } from '../../utils/currency';
import { saleUnitPrice, hasDiscount } from '../../utils/productPrice';

// A product's price as the customer pays it. On offer, the old price is struck
// through beside the new one with the discount, so the desk sees both.
export default function PriceTag({ product, size = 13, color = 'var(--accent-gold)' }) {
  const off = hasDiscount(product);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: size, fontWeight: 700, color }}>{formatMoney(saleUnitPrice(product))}</span>
      {off && <span style={{ fontSize: Math.max(10, size - 3), color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatMoney(product.price)}</span>}
      {off && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', background: 'var(--accent-green-dim)', borderRadius: 20, padding: '1px 6px' }}>-{product.discountPercent}%</span>}
    </span>
  );
}
