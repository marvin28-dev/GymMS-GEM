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

module.exports = { toPaymentMethod, METHODS };
