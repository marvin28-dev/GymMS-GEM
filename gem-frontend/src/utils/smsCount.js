// How many texts a message makes: 160 characters (153 a part once split), or 70
// (67) once it holds a character outside the plain SMS alphabet (ê, ç, emoji).
// Mirrors smsParts in gem-backend/src/utils/sms.js.
const GSM7 = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;

export function smsInfo(text) {
  const s = String(text || '');
  const gsm = GSM7.test(s);
  const len = gsm ? [...s].reduce((n, c) => n + ('^{}\\[~]|€'.includes(c) ? 2 : 1), 0) : [...s].length;
  const parts = !len ? 0 : len <= (gsm ? 160 : 70) ? 1 : Math.ceil(len / (gsm ? 153 : 67));
  return { len, parts, limit: parts <= 1 ? (gsm ? 160 : 70) : parts * (gsm ? 153 : 67), unicode: !gsm };
}

export const hasEmail = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(m?.email || '').trim());
export const hasPhone = (m) => String(m?.phone || '').replace(/\D/g, '').length >= 6;

// {firstName} and the like, filled in from one person's values (the server's
// sample: lower-case keys, as in gem-backend/src/utils/messaging.js fieldValues)
const FILL_IN = /\{\s*([a-zA-Z]+)\s*\}/g;
export const hasFillIns = (text) => /\{\s*[a-zA-Z]+\s*\}/.test(String(text || ''));
export const fillIn = (text, sample) => String(text || '').replace(FILL_IN, (all, key) => (sample && key.toLowerCase() in sample ? sample[key.toLowerCase()] : all));

// The words that fill in per person, as the Communication page offers them
export const TOKENS = [['firstName', 'tokFirstName'], ['endDate', 'tokEndDate'], ['balance', 'tokBalance'], ['gymName', 'tokGymName'], ['gymPhone', 'tokGymPhone']];
