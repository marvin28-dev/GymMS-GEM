// GEM's own support contacts, set when the app is built (D-33):
// VITE_SUPPORT_EMAIL, and VITE_SUPPORT_WHATSAPP as the number with its country
// code. Until they are set no page offers any: five pages showed an address
// and a WhatsApp number that may not have been GEM's.
const email = String(import.meta.env.VITE_SUPPORT_EMAIL || '').trim();
const whatsapp = String(import.meta.env.VITE_SUPPORT_WHATSAPP || '').replace(/\D/g, '');

export const SUPPORT = {
  email,
  whatsapp,
  whatsappUrl: whatsapp ? `https://wa.me/${whatsapp}` : '',
  whatsappLabel: whatsapp ? `+${whatsapp}` : '',
};

export const hasSupport = !!(email || whatsapp);

// Who makes GEM: "Powered by Ekoteksolutions Inc." (components/ui/PoweredBy.jsx,
// the payslip PDF). The server's emails and receipts name it in utils/emailLayout.js.
export const MAKER = 'Ekoteksolutions Inc.';
