const PDFDocument = require('pdfkit');
const { formatMoney, SYMBOLS, currencyOf } = require('./money');

const METHOD_NAMES = { cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer', mobile_money: 'Mobile money' };

const GOLD = '#b08d4a';
const GOLD_SOFT = '#f3ead9';
const INK = '#14141b';
const BODY = '#3f3f4a';
const MUTED = '#8a8a97';
const HAIRLINE = '#e6e6ec';
const PAPER = '#ffffff';

// PDFKit's built-in Helvetica only covers WinAnsi, so symbols like the naira
// sign render as a broken glyph. Fall back to the ISO code when that would
// happen, which reads correctly rather than looking corrupt.
const WINANSI_SAFE = /^[\x20-\x7E\xA0-\xFF]*$/;
function pdfCurrency(symbol, code) {
  const s = String(symbol || '').trim();
  if (s && WINANSI_SAFE.test(s)) return s;
  return String(code || '').trim() || s;
}

// Renders a payment receipt and resolves with the finished PDF as a Buffer,
// ready to attach to an email.
function buildReceiptPdf({ gym, member, payment, currencyCode }) {
  const code = currencyOf({ currency: currencyCode, country: gym?.country });
  const sign = pdfCurrency(SYMBOLS[code] || code, code);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // The gym's own currency and number style, with a sign the PDF font can draw
    const money = (v) => formatMoney(v, code, sign);
    const PAGE_W = doc.page.width;
    const M = 52;                       // page margin
    const W = PAGE_W - M * 2;           // content width

    doc.rect(0, 0, PAGE_W, doc.page.height).fill(PAPER);

    // ── Masthead ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, PAGE_W, 6).fill(GOLD);

    let y = 58;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(19).text(gym.name, M, y, { width: W * 0.6 });

    const place = [gym.location, gym.city, gym.country].filter(Boolean).join(', ');
    if (place) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(place, M, doc.y + 2, { width: W * 0.6 });
    }

    // "RECEIPT" sits opposite the gym name
    doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(11)
      .text('RECEIPT', M + W * 0.6, 60, { width: W * 0.4, align: 'right', characterSpacing: 3 });
    doc.fillColor(MUTED).font('Helvetica').fontSize(9)
      .text(new Date(payment.createdAt || Date.now()).toLocaleDateString('en-GB'),
        M + W * 0.6, doc.y + 3, { width: W * 0.4, align: 'right' });

    y = Math.max(doc.y, 112) + 18;
    doc.moveTo(M, y).lineTo(M + W, y).lineWidth(1).strokeColor(HAIRLINE).stroke();
    y += 26;

    // ── Amount panel, the thing the reader looks for first ────────────────────
    const panelH = 78;
    doc.roundedRect(M, y, W, panelH, 10).fill(GOLD_SOFT);
    doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(8)
      .text('AMOUNT PAID', M, y + 18, { width: W, align: 'center', characterSpacing: 2 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(27)
      .text(money(payment.amount), M, y + 34, { width: W, align: 'center' });
    y += panelH + 30;

    // ── Detail rows ───────────────────────────────────────────────────────────
    const rows = [
      ['Receipt reference', payment.reference],
      ['Paid by', `${member.firstName || ''} ${member.lastName || ''}`.trim()],
      ['Member ID', member.memberCode],
      ['Payment method', METHOD_NAMES[payment.method] || String(payment.method || '').replace(/_/g, ' ')],
      ['Description', payment.note],
      payment.balanceAfter != null ? ['Balance after payment', money(payment.balanceAfter)] : null,
    ].filter(r => r && r[1] !== null && r[1] !== undefined && String(r[1]).trim() !== '');

    doc.fontSize(10.5);
    for (const [label, value] of rows) {
      doc.fillColor(MUTED).font('Helvetica').text(label, M, y, { width: W * 0.45 });
      doc.fillColor(INK).font('Helvetica-Bold')
        .text(String(value), M + W * 0.45, y, { width: W * 0.55, align: 'right' });
      y += 17;
      doc.moveTo(M, y + 3).lineTo(M + W, y + 3).lineWidth(0.5).strokeColor(HAIRLINE).stroke();
      y += 12;
    }

    y += 12;
    doc.fillColor(BODY).font('Helvetica').fontSize(10.5)
      .text('Thank you for your payment. Please keep this receipt for your records.', M, y, { width: W });

    // ── Footer pinned to the bottom of the page ───────────────────────────────
    const contact = [gym.phone, gym.email, gym.website].filter(Boolean);
    const socials = [
      gym.facebook && `Facebook ${gym.facebook}`,
      gym.instagram && `Instagram ${gym.instagram}`,
      gym.twitter && `X ${gym.twitter}`,
    ].filter(Boolean);

    const footerTop = doc.page.height - 118;
    doc.moveTo(M, footerTop).lineTo(M + W, footerTop).lineWidth(1).strokeColor(HAIRLINE).stroke();

    let fy = footerTop + 16;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(gym.name, M, fy, { width: W, align: 'center' });
    fy = doc.y + 4;

    if (contact.length) {
      doc.fillColor(BODY).font('Helvetica').fontSize(8.5)
        .text(contact.join('    '), M, fy, { width: W, align: 'center' });
      fy = doc.y + 3;
    }

    if (socials.length) {
      doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(8.5)
        .text(socials.join('    '), M, fy, { width: W, align: 'center' });
      fy = doc.y + 6;
    }

    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5)
      .text('Powered by GEM', M, fy, { width: W, align: 'center' });

    doc.rect(0, doc.page.height - 6, PAGE_W, 6).fill(GOLD);

    doc.end();
  });
}

module.exports = { buildReceiptPdf };
