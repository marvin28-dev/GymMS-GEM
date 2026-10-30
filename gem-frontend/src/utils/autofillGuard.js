// Browsers fill saved sign-ins, names and addresses into boxes on their own,
// and the owner asked for none of it (30 October 2026): not on the sign-in
// pages, not on sign-up, not in any form, not where a password shows a code.
// One guard on the whole document marks every box, present and future, and
// marks it again when a show-password button changes its type. A password box
// is marked "new-password", the one mark browsers do not fill a saved password
// into (they ignore "off" there); every other box and form is marked "off".
const SKIP = new Set(['hidden', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color']);

const markFor = (el) => {
  if (el instanceof HTMLFormElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return 'off';
  if (!(el instanceof HTMLInputElement) || SKIP.has(el.type)) return null;
  return el.type === 'password' ? 'new-password' : 'off';
};

function mark(el) {
  const want = markFor(el);
  if (want && el.getAttribute('autocomplete') !== want) el.setAttribute('autocomplete', want);
}

function markAll(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  mark(node);
  node.querySelectorAll('input, textarea, select, form').forEach(mark);
}

export function installAutofillGuard() {
  if (typeof document === 'undefined' || window.__gemAutofillGuard) return;
  window.__gemAutofillGuard = true;
  markAll(document.documentElement);
  new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === 'attributes') mark(change.target);
      else change.addedNodes.forEach(markAll);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['autocomplete', 'type'] });
}
