// Members' numbers are written the local way ("6 77 12 34 56"). A text message
// needs the full international form (+237677123456), so the gym's country code
// is put in front when it is missing. Mirrors gem-frontend/src/utils/contact.js.
const DIAL_BY_COUNTRY = {
  cameroon: '237', nigeria: '234', ghana: '233', senegal: '221', "côte d'ivoire": '225', "cote d'ivoire": '225',
  kenya: '254', 'south africa': '27', france: '33', 'united kingdom': '44', 'united states': '1',
};
const KNOWN_DIALS = [...new Set(Object.values(DIAL_BY_COUNTRY))].sort((a, b) => b.length - a.length);

// The gym's dial code: from its country, or else from its own phone number
function dialFor(country, gymPhone) {
  const byCountry = DIAL_BY_COUNTRY[String(country || '').trim().toLowerCase()];
  if (byCountry) return byCountry;
  const g = String(gymPhone || '').trim();
  if (g.startsWith('+')) return KNOWN_DIALS.find(d => g.replace(/\D/g, '').startsWith(d)) || '';
  return '';
}

// { e164: '+237677123456' } or { problem: 'missing' | 'no_country' | 'invalid' }
function readPhone(phone, country, gymPhone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return { problem: 'missing' };
  let d;
  if (raw.startsWith('+')) d = digits;
  else if (digits.startsWith('00')) d = digits.slice(2);
  else {
    const dial = dialFor(country, gymPhone);
    if (dial && digits.startsWith(dial) && digits.length > dial.length + 6) d = digits;
    else if (!dial) return { problem: 'no_country' };
    else d = dial + digits.replace(/^0/, '');
  }
  return d.length >= 8 && d.length <= 15 ? { e164: `+${d}` } : { problem: 'invalid' };
}

const toE164 = (phone, country, gymPhone) => readPhone(phone, country, gymPhone).e164 || null;

module.exports = { toE164, readPhone, dialFor };
