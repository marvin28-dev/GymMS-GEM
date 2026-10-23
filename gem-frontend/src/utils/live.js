import { getAuth } from './auth';
import { notifyDataChanged, LIVE_CHANGED, CLIENT_ID } from './events';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
let source = null;
let token = null;
let openedAt = 0;
let everOpened = false;

const announce = (detail) => {
  try { window.dispatchEvent(new CustomEvent(LIVE_CHANGED, { detail })); } catch { /* non-browser */ }
};

// The stream is opened with a one-use ticket, so the sign-in token never goes in
// a URL (where proxies log it). A dropped stream cannot reuse its ticket, so
// startLive() opens a new one, with a new ticket.
async function open(t) {
  close();
  token = t;
  openedAt = Date.now();
  let ticket;
  try {
    const res = await fetch(`${BASE}/live/ticket`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } });
    if (!res.ok) return;
    ({ ticket } = await res.json());
  } catch { return; }
  // Signed out or switched accounts while the ticket was on its way
  if (token !== t || source) return;
  try {
    source = new EventSource(`${BASE}/live?ticket=${encodeURIComponent(ticket)}`);
  } catch { source = null; return; }
  source.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    // This tab announced its own writes the moment they succeeded (services/api.js)
    if (msg.origin && msg.origin === CLIENT_ID) return;
    announce(msg);
    notifyDataChanged();
  };
  // Every connection after the first may have missed changes while it was
  // down (the server restarted, the network dropped), so screens catch up
  source.onopen = () => {
    if (everOpened) announce({ resource: '*' });
    everOpened = true;
  };
}

function close() {
  if (source) { try { source.close(); } catch { /* already closed */ } }
  source = null;
  token = null;
}

// Keeps exactly one stream open for whoever is signed in on this tab, and
// follows sign-in, sign-out and switching accounts without being told. The
// browser retries a dropped stream by itself, but gives up for good after an
// error response (a server mid-restart, say); a stream left closed is opened
// again here.
export function startLive() {
  const sync = () => {
    const t = getAuth()?.token || null;
    if (!t) { if (source) close(); return; }
    const closed = !source || source.readyState === 2;
    if (t !== token || (closed && Date.now() - openedAt > 5000)) open(t);
  };
  sync();
  const id = setInterval(sync, 3000);
  return () => { clearInterval(id); close(); };
}
