// Lets long-lived chrome (the header's notifications, the sidebar badges) know
// that data it summarises has changed, without threading state through the tree.
export const DATA_CHANGED = 'gem:data-changed';

// Fired when ANOTHER screen changed something (see utils/live.js)
export const LIVE_CHANGED = 'gem:live-changed';
// Names this tab, so the server's announcement of its own writes can be ignored
export const CLIENT_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

let pending = null;

// Writes often arrive in bursts, such as creating a member and immediately
// recording their registration fee. Coalesce those into one refresh.
export function notifyDataChanged() {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    try { window.dispatchEvent(new Event(DATA_CHANGED)); } catch { /* non-browser context */ }
  }, 300);
}
