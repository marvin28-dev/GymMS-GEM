import { getGymCountry } from './auth';
import { countryByName, countryByCode } from './countries';

// Coaches reach members by WhatsApp and calls. Numbers are written the local
// way ("6 77 12 34 56"); WhatsApp needs them in full international form, so the
// gym's country code is put in front when it is missing.
function dialDigits() {
  const name = getGymCountry();
  const c = countryByName(name) || countryByCode(name);
  return (c?.dial || '').replace(/\D/g, '');
}

export function intlDigits(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw.replace(/\D/g, '');
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) return d.slice(2);
  const dial = dialDigits();
  if (dial && d.startsWith(dial) && d.length > dial.length + 6) return d;
  return dial + d.replace(/^0/, '');
}

export const hasPhone = (phone) => intlDigits(phone).length >= 8;
export const whatsappLink = (phone, text = '') => `https://wa.me/${intlDigits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const callLink = (phone) => `tel:+${intlDigits(phone)}`;
