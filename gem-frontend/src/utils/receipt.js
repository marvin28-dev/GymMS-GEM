import { getAuth } from './auth';

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

// Gym identity + contact details, read from the cached gym record. Every field
// comes from the server, so a receipt can't print a previous gym's details.
export function getGymInfo() {
  const user = getAuth()?.user || {};
  const g = readJSON(`gem_dash_${user.gymId}_gym`, {}) || {};

  return {
    name: g.name || user.gymName || 'GEM',
    location: g.location || '',
    phone: g.phone || g.altPhone || '',
    email: g.email || '',
    website: g.website || '',
    facebook: g.facebook || '',
    instagram: g.instagram || '',
    twitter: g.twitter || '',
  };
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Contact + social block printed at the foot of anything a client receives.
export function gymContactFooterHtml() {
  const g = getGymInfo();

  const contact = [g.phone, g.email, g.website].filter(Boolean);
  const socials = [
    g.facebook && `Facebook: ${g.facebook}`,
    g.instagram && `Instagram: ${g.instagram}`,
    g.twitter && `X/Twitter: ${g.twitter}`,
  ].filter(Boolean);

  if (!contact.length && !socials.length && !g.location) return '';

  return `
    <div class="gym-contact">
      ${g.location ? `<div>${escapeHtml(g.location)}</div>` : ''}
      ${contact.length ? `<div>${contact.map(escapeHtml).join(' &nbsp;·&nbsp; ')}</div>` : ''}
      ${socials.length ? `<div class="socials">${socials.map(escapeHtml).join(' &nbsp;·&nbsp; ')}</div>` : ''}
    </div>
  `;
}

export const RECEIPT_CSS = `
  body { font-family: 'Courier New', monospace; padding: 32px; color: #111; font-size: 13px; }
  h2 { text-align: center; letter-spacing: 2px; font-size: 18px; margin-bottom: 4px; }
  .sub { text-align: center; color: #666; margin-bottom: 24px; font-size: 11px; }
  hr { border: none; border-top: 1px dashed #ccc; margin: 16px 0; }
  .row { display: flex; justify-content: space-between; margin: 8px 0; gap: 16px; }
  .label { color: #666; }
  .amount { font-size: 28px; font-weight: bold; text-align: center; margin: 20px 0; }
  .status { text-align: center; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
  .footer { text-align: center; color: #999; font-size: 10px; margin-top: 28px; }
  .gym-contact { text-align: center; color: #666; font-size: 10px; margin-top: 14px; line-height: 1.7;
                 border-top: 1px dashed #ccc; padding-top: 12px; }
  .gym-contact .socials { color: #888; }
`;

// Opens the browser print dialog on a standalone receipt document, which is
// how the user saves it as a PDF.
export function printReceiptDocument({ title, bodyHtml }) {
  const win = window.open('', '_blank', 'width=480,height=680');
  if (!win) return false;
  win.document.write(`<html><head><title>${escapeHtml(title)}</title><style>${RECEIPT_CSS}</style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}

// A picture address fit for an <img> in a printed document: a web address or
// an embedded image, nothing that could run as code. Anything else is dropped.
export function safeImageSrc(src) {
  const value = String(src ?? '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
  return '';
}

// Writes a finished document into a new window and prints it. The window shares
// the app's origin, so every value placed in `html` must already be escaped.
// A blocked pop-up returns false instead of throwing.
export function openPrintWindow(html, { features = '', closeAfterPrint = false, delay = 400 } = {}) {
  const win = window.open('', '_blank', features);
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  if (closeAfterPrint) win.onafterprint = () => win.close();
  win.focus();
  setTimeout(() => win.print(), delay);
  return true;
}

export { escapeHtml };
