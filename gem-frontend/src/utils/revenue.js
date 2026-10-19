import { dayStr } from './date';
import { profitOf } from './productPrice';

// What the gym earned: what members paid (memberships, registration fees, day
// passes and visitor bundles, anything else) plus what the shop made over the
// cost of what it sold. The shop counts by its profit, not the full amount it
// took in. Every screen that says "revenue" adds it up here, so the Dashboard,
// Daily Overview, end-of-day report and Accounting always agree.
const PART_OF_TYPE = { membership: 'memberships', registration: 'registration', product: 'passes', other: 'other' };

// inDay gets each record's local day ('YYYY-MM-DD') and says whether it counts.
// costNow (product id -> cost) prices sales made before a sale kept its own cost.
export function revenueOf(payments = [], sales = [], inDay = () => true, costNow = {}) {
  const parts = { memberships: 0, registration: 0, passes: 0, other: 0 };
  for (const p of payments) {
    if (inDay(dayStr(p.createdAt))) parts[PART_OF_TYPE[p.type] || 'other'] += Number(p.amount) || 0;
  }
  const daySales = sales.filter(s => inDay(dayStr(s.createdAt)));
  const { profit, missing } = profitOf(daySales, costNow);
  const shopSales = daySales.reduce((n, s) => n + (Number(s.total) || 0), 0);
  const members = parts.memberships + parts.registration + parts.passes + parts.other;
  return { ...parts, members, shop: profit, shopSales, shopMissing: missing, total: members + profit };
}
