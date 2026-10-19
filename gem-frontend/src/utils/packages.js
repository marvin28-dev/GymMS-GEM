// Session allowance a package grants.
// Returns null when the package is unlimited, which means no session limit.
export function packageAllowance(pkg) {
  if (!pkg) return null;
  if (pkg.maxPasses != null && Number(pkg.maxPasses) > 0) return Number(pkg.maxPasses);
  const raw = String(pkg.sessions ?? '').trim();
  if (!raw || /unlimited/i.test(raw)) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
