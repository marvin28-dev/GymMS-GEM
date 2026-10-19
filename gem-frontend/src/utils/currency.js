import { getGymCurrency, getGymCountry } from './auth';
import { countryByName } from './countries';

// What the gym's money is called and how its numbers are written.
//
// The gym record is the only authority. A gym in Kumasi reads GH₵250 for the
// owner, for the manager, and on every device either of them signs in on,
// because the currency travels with the session rather than being remembered
// by whichever browser happened to set the gym up.

const SYMBOLS = { XAF: 'FCFA', XOF: 'FCFA', NGN: '₦', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', USD: '$', EUR: '€', GBP: '£' };
const LOCALES = { XAF: 'fr-FR', XOF: 'fr-FR', NGN: 'en-NG', GHS: 'en-GH', KES: 'en-KE', ZAR: 'en-ZA', USD: 'en-US', EUR: 'fr-FR', GBP: 'en-GB' };
// ₦15,000 but 15 000 FCFA
const SYMBOL_FIRST = new Set(['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'GBP']);

// The gym's currency code. Older sessions predate the gym carrying one, so the
// country it sits in answers for them.
export function getCurrencyCode() {
  const stored = getGymCurrency();
  if (stored && SYMBOLS[stored]) return stored;
  return countryByName(getGymCountry())?.currency || 'XAF';
}

export function getCurrencySymbol() {
  const code = getCurrencyCode();
  return SYMBOLS[code] || code;
}

export function getMoneyLocale() {
  return LOCALES[getCurrencyCode()] || 'en-GB';
}

// Some currencies are written in front of the number and some after it:
// ₦15,000 but 15 000 FCFA.
export function symbolGoesFirst() {
  return SYMBOL_FIRST.has(getCurrencyCode());
}

// Prices are whole units of currency throughout GEM, never fractions.
export const formatMoney = (amount) => {
  // fr-FR groups thousands with a narrow no-break space (U+202F) some fonts have
  // no glyph for, which shows as a stray mark; normalise to a plain space.
  const n = Math.round(Number(amount) || 0).toLocaleString(getMoneyLocale()).replace(/[  ]/g, ' ');
  const symbol = getCurrencySymbol();
  return symbolGoesFirst() ? `${symbol}${n}` : `${n} ${symbol}`;
};

export { SYMBOLS as CURRENCY_SYMBOLS };
