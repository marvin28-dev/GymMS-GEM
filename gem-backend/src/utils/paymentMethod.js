// Every name a form or an older record may use for how money was paid, mapped
// to the stored PaymentMethod. One table for every controller: two partial ones
// once recorded every card and mobile-money payment as cash.
const METHODS = {
  cash: 'cash', Cash: 'cash',
  card: 'card', Card: 'card', 'Credit/Debit Card': 'card', 'Credit Card': 'card', 'Debit Card': 'card',
  bank_transfer: 'bank_transfer', 'Bank Transfer': 'bank_transfer', Transfer: 'bank_transfer', transfer: 'bank_transfer',
  mobile_money: 'mobile_money', 'Mobile Money': 'mobile_money', 'Mobile Pay': 'mobile_money', mobile: 'mobile_money',
};

const toPaymentMethod = (name) => METHODS[name] || 'cash';

// How a request says it was paid. Naming nothing is cash, as the forms always
// meant; a name not in the table is refused instead of being counted as cash
// in the drawer (D-54).
function readPaymentMethod(name, field = 'method') {
  if (name === undefined || name === null || String(name).trim() === '') return { method: 'cash' };
  const method = METHODS[String(name).trim()];
  if (method) return { method };
  return { error: `"${String(name).slice(0, 40)}" is not a way of paying this app records. Choose cash, card, bank transfer or mobile money.`, field };
}

module.exports = { toPaymentMethod, readPaymentMethod, METHODS };
