import { jsPDF } from 'jspdf';
import { getCurrencySymbol, getMoneyLocale, symbolGoesFirst } from './currency';
import { countryByName } from './countries';
import { getGymCountry } from './auth';

// The fonts built into a PDF cannot draw every currency sign (₦ and ₵ among
// them). Those are written as their three-letter code instead, which is what
// a printed payslip would say anyway.
const PRINTABLE = new Set(['FCFA', 'KSh', 'R', '$', '£', '€', 'EUR', 'GBP', 'USD']);

function pdfMoney(amount) {
  const n = Math.round(Number(amount) || 0).toLocaleString(getMoneyLocale()).replace(/[\u202F\u00A0]/g, ' ');
  const symbol = getCurrencySymbol();
  if (!PRINTABLE.has(symbol)) {
    const code = countryByName(getGymCountry())?.currency || symbol;
    return `${code} ${n}`;
  }
  return symbolGoesFirst() ? `${symbol}${n}` : `${n} ${symbol}`;
}

const GOLD = [176, 141, 74];
const INK = [24, 24, 32];
const MUTED = [110, 110, 125];
const RULE = [225, 222, 214];
const RED = [180, 50, 50];

// A payslip for one pay period, saved as a PDF.
export function downloadPaystubPdf(stub) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 18;
  let y = 0;

  // Header band
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(stub.gymName || 'Payslip', M, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text('PAYSLIP', M, 24);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(stub.month, W - M, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text((stub.status === 'paid' ? 'PAID' : 'ISSUED, AWAITING PAYMENT'), W - M, 24, { align: 'right' });
  y = 46;

  // Who and when
  const field = (label, value, x) => {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, y);
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(String(value || '-'), x, y + 6);
  };
  const col2 = W / 2 + 4;
  field('Employee', stub.employeeName, M);
  field('Role', stub.role, col2);
  y += 16;
  field('Employment', stub.employment, M);
  field('Pay period', stub.month, col2);
  y += 16;
  if (stub.issuedAt || stub.paidAt) {
    field('Issued on', stub.issuedAt, M);
    field('Paid on', stub.paidAt || 'Not yet', col2);
    y += 16;
  }
  if (stub.hours != null) {
    field('Hours worked', `${stub.hours} hrs`, M);
    field('Hourly rate', stub.rate != null ? pdfMoney(stub.rate) : '-', col2);
    y += 16;
  }

  // A section: heading, lines, total
  const section = (title, rows, totalLabel, total, color = INK, sign = '') => {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text(title.toUpperCase(), M, y);
    y += 3;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(M, y, W - M, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    if (!rows.length) {
      doc.setTextColor(...MUTED);
      doc.text('None this period', M, y);
      y += 7;
    }
    rows.forEach(r => {
      doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(r.label, W - 2 * M - 50)[0], M, y);
      doc.setTextColor(...color);
      doc.text(`${sign}${pdfMoney(r.amount)}`, W - M, y, { align: 'right' });
      y += 7;
    });
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.line(M, y - 3, W - M, y - 3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.text(totalLabel, M, y + 3);
    doc.setTextColor(...color);
    doc.text(`${sign}${pdfMoney(total)}`, W - M, y + 3, { align: 'right' });
    y += 12;
  };

  section('Earnings', [
    { label: stub.hours != null ? 'Pay for hours worked' : 'Basic salary', amount: stub.basePay },
    ...(stub.bonuses || []).map(b => ({ label: b.recurring === false ? `${b.label} (one time)` : b.label, amount: b.amount })),
  ], 'Pay', stub.grossPay);

  section('Deductions', (stub.deductions || []).map(d => ({ label: d.label, amount: d.amount })), 'Total withheld', stub.totalDeductions, RED, stub.totalDeductions ? '-' : '');

  // The summary: the pay the books show, and what was handed over
  y += 2;
  doc.setFillColor(248, 244, 234);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(M, y, W - 2 * M, stub.totalDeductions ? 34 : 24, 2, 2, 'FD');
  let sy = y + 9;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text('Pay (recorded in the accounts)', M + 6, sy);
  doc.text(pdfMoney(stub.grossPay), W - M - 6, sy, { align: 'right' });
  if (stub.totalDeductions) {
    sy += 8;
    doc.setTextColor(...RED);
    doc.text('Withheld for deductions', M + 6, sy);
    doc.text(`-${pdfMoney(stub.totalDeductions)}`, W - M - 6, sy, { align: 'right' });
  }
  sy += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text('Net pay', M + 6, sy);
  doc.setTextColor(...GOLD);
  doc.text(pdfMoney(stub.netPay), W - M - 6, sy, { align: 'right' });
  y += (stub.totalDeductions ? 34 : 24) + 10;

  if (stub.note) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('NOTES', M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(stub.note, W - 2 * M), M, y + 6);
  }

  // Footer
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...RULE);
  doc.line(M, H - 18, W - M, H - 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Generated by GEM on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, M, H - 12);
  doc.text(stub.gymName || '', W - M, H - 12, { align: 'right' });

  const safe = (v) => String(v || '').trim().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
  doc.save(`Payslip_${safe(stub.employeeName)}_${safe(stub.month)}.pdf`);
}

export { pdfMoney };
