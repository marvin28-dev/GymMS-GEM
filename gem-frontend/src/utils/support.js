// GEM's own support contacts (D-33), given by the owner on 30 October 2026:
// the number is for WhatsApp only (no calls), and an email. Written here once
// for every page; a build may name others with VITE_SUPPORT_EMAIL and
// VITE_SUPPORT_WHATSAPP (the number with its country code).
const OWN_EMAIL = 'marvin.ekokobe01@gmail.com';
// Given as 3439889766: area code 343 is Ontario's, so the country code is 1
const OWN_WHATSAPP = '13439889766';

const email = String(import.meta.env.VITE_SUPPORT_EMAIL || OWN_EMAIL).trim();
const whatsapp = String(import.meta.env.VITE_SUPPORT_WHATSAPP || OWN_WHATSAPP).replace(/\D/g, '');

// +1 343 988 9766 for a North American number; any other as its digits
const shown = (d) => (d.length === 11 && d.startsWith('1') ? `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : `+${d}`);

export const SUPPORT = {
  email,
  whatsapp,
  whatsappUrl: whatsapp ? `https://wa.me/${whatsapp}` : '',
  whatsappLabel: whatsapp ? shown(whatsapp) : '',
};

export const hasSupport = !!(email || whatsapp);

// Who makes GEM: "Powered by Ekoteksolutions Inc." (components/ui/PoweredBy.jsx,
// the payslip PDF). The server's emails and receipts name it in utils/emailLayout.js.
export const MAKER = 'Ekoteksolutions Inc.';
