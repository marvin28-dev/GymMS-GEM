// The ways a gym can take money. Settings decides which of them a form offers;
// this is the one list they are all named from, so "Mobile Money" means the
// same thing on the payment form, in Settings and in the database.

export const PAYMENT_METHODS = [
  { key: 'Cash', labelKey: 'settings.methodCash', api: 'cash' },
  { key: 'Credit/Debit Card', labelKey: 'settings.methodCard', api: 'card' },
  { key: 'Bank Transfer', labelKey: 'settings.methodTransfer', api: 'bank_transfer' },
  { key: 'Mobile Money', labelKey: 'settings.methodMobile', api: 'mobile_money' },
];

// Older records and forms wrote these names. They still have to resolve.
const ALIASES = {
  Card: 'Credit/Debit Card',
  'Mobile Pay': 'Mobile Money',
  card: 'Credit/Debit Card',
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
};

export const canonicalMethod = (name) => ALIASES[name] || name;

// The methods this gym accepts, in the order above. A gym that has not been
// through Settings yet has chosen nothing, which means all of them are open -
// not none of them. Reading an empty list as "cash only" would quietly leave
// every new gym unable to take a card.
export function enabledMethods(settings) {
  const saved = settings?.payment?.methods;
  if (!Array.isArray(saved) || saved.length === 0) return PAYMENT_METHODS;
  const on = new Set(saved.map(canonicalMethod));
  const list = PAYMENT_METHODS.filter(m => on.has(m.key));
  return list.length ? list : PAYMENT_METHODS;
}

// The method a form holds, or the gym's first one when the gym does not take
// it: a form started on Cash showed the first method the gym takes and saved
// Cash (D-26)
export function acceptedMethod(wanted, methods) {
  const key = canonicalMethod(wanted);
  return methods.some(m => m.key === key) ? key : (methods[0]?.key || 'Cash');
}

export const apiMethod = (name) => PAYMENT_METHODS.find(m => m.key === canonicalMethod(name))?.api || 'cash';
