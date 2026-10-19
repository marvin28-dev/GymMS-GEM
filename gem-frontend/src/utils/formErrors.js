// Errors go under the field that caused them. The server names the field in
// its refusals ({ error, field }); one that does not is shown for the whole form.
export function serverFieldError(err, fallback) {
  const data = err?.response?.data || {};
  if (data.field) revealFirstError();
  return { field: data.field || null, message: data.error || fallback };
}

// The small red line that sits under a field
export const fieldErrorStyle = { fontSize: 11.5, color: 'var(--accent-red)', marginTop: 4, fontFamily: 'DM Sans', display: 'block' };

// After a refused save, bring the first flagged field into view: on a long
// form (or a phone) the Save button sits far below the fields it complains
// about. Runs once the errors have rendered.
export function revealFirstError() {
  setTimeout(() => {
    const dialogs = document.querySelectorAll('[role="dialog"]');
    const scope = dialogs.length ? dialogs[dialogs.length - 1] : document;
    const el = scope.querySelector('[data-field-error], [role="alert"]');
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, 30);
}
