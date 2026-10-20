// The page buttons under a long list: every page while there are few, otherwise
// the first, the last and the ones around the current page, with … for the gaps.
export function pageNumbers(total, current) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const shown = [...new Set([1, total, current - 1, current, current + 1])].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  shown.forEach((n, i) => { if (i && n - shown[i - 1] > 1) out.push('…'); out.push(n); });
  return out;
}
