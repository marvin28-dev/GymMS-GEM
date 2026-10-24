// Every form's visible label names the box it stands over (F-092). Most forms
// write a <label> and then the box, without tying the two together, so a
// screen reader announced an unnamed box and a click on the label did nothing.
// One watcher on the whole document ties each such label to the box right
// after it, so a new form is covered without anyone remembering to. A box
// that already has a name (its own label, aria-label, aria-labelledby, or a
// label around it, like each day's tick on the opening hours) is left alone,
// so a heading over a group never takes over its boxes.

const CONTROL = 'input:not([type="hidden"]), select, textarea';
let next = 0;

const hasName = (el) => el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')
  || !!el.closest('label') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));

// The box a label stands over: the element right after it, or the first box
// inside that element (a box with an eye button beside it, say)
function boxFor(label) {
  const after = label.nextElementSibling;
  if (!after) return null;
  if (after.matches(CONTROL)) return after;
  const inside = after.querySelectorAll(CONTROL);
  return inside.length === 1 ? inside[0] : null;
}

function link(label) {
  // Already tied to a box that is still there (by the form itself, or here)
  if ((label.htmlFor && document.getElementById(label.htmlFor)) || label.querySelector(CONTROL)) return;
  const box = boxFor(label);
  if (!box || hasName(box)) return;
  if (!box.id) { next += 1; box.id = `gem-field-${next}`; }
  label.htmlFor = box.id;
}

function linkWithin(root) {
  if (root.nodeType !== 1) return;
  if (root.matches('label')) link(root);
  root.querySelectorAll('label').forEach(link);
}

export function installLabelLinker() {
  if (typeof document === 'undefined' || window.__gemLabelLinker) return;
  window.__gemLabelLinker = true;
  const start = () => {
    linkWithin(document.body);
    // The part of the page that changed is looked at again: a box drawn anew
    // after its label, or a label whose box was replaced, is tied up again
    new MutationObserver((changes) => {
      new Set(changes.map(c => c.target)).forEach(linkWithin);
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
}
