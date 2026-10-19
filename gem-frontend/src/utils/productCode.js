// A suggested product code from its name, e.g. "Whey Protein (1kg)" -> WHEP1-001:
// the first three letters of the first word, the first letter of the rest, then
// the lowest number not already used. The staff can type their own instead.
export function suggestProductCode(name, takenCodes = []) {
  const words = String(name || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const base = words.map((w, i) => (i === 0 ? w.slice(0, 3) : w[0])).join('').slice(0, 6) || 'PRD';
  const taken = new Set(takenCodes.filter(Boolean).map(c => String(c).toUpperCase()));
  let n = 1;
  let code;
  do { code = `${base}-${String(n).padStart(3, '0')}`; n += 1; } while (taken.has(code));
  return code;
}
