const { AsyncLocalStorage } = require('async_hooks');

// Amounts in notifications and the Log are written in the gym's own currency.
// Every signed-in request knows its gym, so the currency is carried along with
// the request rather than passed by hand to every place that writes a figure.
const context = new AsyncLocalStorage();

const SYMBOLS = { XAF: 'FCFA', XOF: 'FCFA', NGN: '₦', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', USD: '$', EUR: '€', GBP: '£' };
const LOCALES = { XAF: 'fr-FR', XOF: 'fr-FR', NGN: 'en-NG', GHS: 'en-GH', KES: 'en-KE', ZAR: 'en-ZA', USD: 'en-US', EUR: 'fr-FR', GBP: 'en-GB' };
// ₦15,000 but 15 000 FCFA
const SYMBOL_FIRST = new Set(['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'GBP']);

// symbol: what to write instead of the usual sign (a PDF font without the
// naira sign writes NGN), keeping the gym's own number style
function formatMoney(amount, currency, symbol) {
  const code = currency || context.getStore()?.currency || 'XAF';
  // fr-FR groups thousands with a narrow no-break space some fonts have no
  // glyph for, which shows as a stray mark; normalise to a plain space
  const n = Math.round(Number(amount) || 0).toLocaleString(LOCALES[code] || 'fr-FR').replace(/[\u202F\u00A0]/g, ' ');
  const sign = symbol || SYMBOLS[code] || code;
  if (!SYMBOL_FIRST.has(code)) return `${n} ${sign}`;
  return /^[A-Z]{3}$/.test(sign) ? `${sign} ${n}` : `${sign}${n}`;
}

// Runs fn with this currency in force for everything it writes
const withCurrency = (currency, fn) => context.run({ currency: currency || 'XAF' }, fn);

// What a gym in each country is paid in. Moving a gym to another country moves
// its money with it, unless somebody names a currency of their own.
const CURRENCY_BY_COUNTRY = {
  cameroon: 'XAF', nigeria: 'NGN', ghana: 'GHS', senegal: 'XOF', "côte d'ivoire": 'XOF',
  "cote d'ivoire": 'XOF', kenya: 'KES', 'south africa': 'ZAR', france: 'EUR',
  'united kingdom': 'GBP', 'united states': 'USD',
};
const currencyForCountry = (country) => CURRENCY_BY_COUNTRY[String(country || '').trim().toLowerCase()] || null;

// A gym's currency code: its own, else its country's
const currencyOf = (gym) => gym?.currency || currencyForCountry(gym?.country) || 'XAF';

module.exports = { formatMoney, withCurrency, SYMBOLS, currencyForCountry, currencyOf };
