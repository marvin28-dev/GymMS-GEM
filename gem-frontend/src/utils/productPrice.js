// What a product sells for right now: its price less its own discount, in
// whole money. The server prices a sale the same way (sale.controller).
export const saleUnitPrice = (p) => Math.round((Number(p?.price) || 0) * (100 - (Number(p?.discountPercent) || 0)) / 100);
export const hasDiscount = (p) => (Number(p?.discountPercent) || 0) > 0;

// What the gym keeps on one item: what it sells for (after its own discount)
// less what it cost. null when no cost price has been entered.
export const profitPerItem = (p) => (p?.costPrice == null || p.costPrice === '') ? null : saleUnitPrice(p) - Math.round(Number(p.costPrice) || 0);
export const marginPct = (p) => {
  const price = saleUnitPrice(p), profit = profitPerItem(p);
  return profit == null || !price ? null : Math.round((profit / price) * 100);
};

// Profit on recorded sales: what they brought in less what their items cost.
// Each item carries its cost from the moment it was sold (unitCost); sales made
// before that was saved use the product's cost now (costNow: id -> cost). A sale
// with an item whose cost is unknown is left out, and its items are counted.
export function profitOf(sales = [], costNow = {}) {
  let profit = 0, missing = 0;
  for (const s of sales) {
    let cost = 0, unknown = 0;
    for (const i of s.items || []) {
      const c = i.unitCost ?? costNow[i.productId] ?? i.product?.costPrice;
      if (c == null) unknown += i.quantity || 0; else cost += Number(c) * (i.quantity || 0);
    }
    if (unknown) missing += unknown; else profit += (Number(s.total) || 0) - cost;
  }
  return { profit: Math.round(profit), missing };
}
