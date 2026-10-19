// Amount and count boxes take digits only, everywhere. One guard on the whole
// document covers every <input type="number"> and every numeric-keypad box, so
// no "-", "+", "e", "." or letter can be typed, pasted or picked on a phone
// keyboard into one, and a new box is covered without anyone remembering to.
// A box that genuinely needs a decimal point (a tax rate) carries data-decimal.
const isNumberBox = (el) => el instanceof HTMLInputElement
  && (el.type === 'number' || el.getAttribute('inputmode') === 'numeric');
const allowed = (el) => (el.hasAttribute('data-decimal') ? /^[0-9.]*$/ : /^[0-9]*$/);

export function installNumberGuard() {
  if (typeof document === 'undefined' || window.__gemNumberGuard) return;
  window.__gemNumberGuard = true;

  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if (!isNumberBox(el) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length === 1 && !allowed(el).test(e.key)) e.preventDefault();
    // The arrow keys must not step a figure below zero
    if (el.type === 'number' && e.key === 'ArrowDown' && Number(el.value || 0) <= Math.max(0, Number(el.min) || 0)) e.preventDefault();
  }, true);

  // Phone keyboards often send no usable key, so the text itself is checked too
  document.addEventListener('beforeinput', (e) => {
    const el = e.target;
    if (isNumberBox(el) && e.data && !allowed(el).test(e.data)) e.preventDefault();
  }, true);

  document.addEventListener('paste', (e) => {
    const el = e.target;
    if (!isNumberBox(el)) return;
    const text = e.clipboardData?.getData('text') || '';
    if (allowed(el).test(text)) return;
    e.preventDefault();
    const clean = text.replace(el.hasAttribute('data-decimal') ? /[^0-9.]/g : /[^0-9]/g, '');
    if (clean) document.execCommand('insertText', false, clean);
  }, true);

  // Scrolling the page over a focused number box would quietly change its value
  document.addEventListener('wheel', () => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement && el.type === 'number') el.blur();
  }, { passive: true });
}
