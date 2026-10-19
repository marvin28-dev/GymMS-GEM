// Keep a figure field to digits only. Amounts in GEM are whole units of
// currency (no decimals), so a money/quantity input should never accept
// letters, spaces, or the e/+/-/. that `type="number"` still lets through.
// Pair with `inputMode="numeric"` on the input.
export const digitsOnly = (v) => String(v ?? '').replace(/[^\d]/g, '');
