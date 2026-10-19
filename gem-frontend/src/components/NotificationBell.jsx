import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X } from 'lucide-react';
import { getAll as getNotifs, markAllRead, remove as removeNotif, removeAll } from '../services/notifications.service';
import { useLanguage } from '../contexts/LanguageContext';
import { DATA_CHANGED } from '../utils/events';
import { getRole } from '../utils/auth';
import { TASKS_PATH } from '../utils/rolePages';

// Every notification points somewhere: the server's own link when it set one,
// otherwise a best guess from its title/type. Nothing is a dead end. Where the
// caller sends the person (and whether a PIN gate stands in the way) is the
// caller's business - the front desk routes this through its exit gate.
function resolveRoute(n) {
  if (n.link) return n.link;
  const title = (n.title || '').toLowerCase();
  if (title.includes('payroll') || title.includes('paystub') || title.includes('pay ')) return '/accounting';
  if (title.includes('member') || title.includes('visitor') || title.includes('signup') || title.includes('registered') || title.includes('enrolled')) return '/members';
  if (title.includes('payment') || title.includes('revenue') || title.includes('paid') || title.includes('received')) return '/payments';
  if (title.includes('task') || title.includes('maintenance') || title.includes('issue') || title.includes('review')) return TASKS_PATH(getRole());
  if (title.includes('staff') || title.includes('employee')) return '/staff';
  if (title.includes('setup') || title.includes('profile') || title.includes('configure') || title.includes('settings')) return '/settings';
  const typeMap = { signup: '/members', payment: '/payments', task: TASKS_PATH(getRole()), membership: '/members', system: '/settings' };
  return typeMap[n.type] || '/dashboard';
}

// The bell for screens that have no app header - the full-screen front desk.
// Somebody on the desk all day was the one person the system could not reach:
// a task, a shift note or a change to the rota had nowhere to appear.

function ago(iso, t) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t('common.justNow');
  if (mins < 60) return t('common.minsAgo', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('common.hoursAgo', { n: hrs });
  return t('common.daysAgoShort', { n: Math.floor(hrs / 24) });
}

export default function NotificationBell({ onOpenLink }) {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const refresh = useCallback(() => {
    getNotifs().then(res => setItems(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const onChanged = () => refresh();
    window.addEventListener(DATA_CHANGED, onChanged);
    // The desk is left open for hours, so nothing would arrive without a poll
    const poll = setInterval(() => { if (!document.hidden) refresh(); }, 60_000);
    return () => { window.removeEventListener(DATA_CHANGED, onChanged); clearInterval(poll); };
  }, [refresh]);

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = items.filter(n => !n.isRead).length;

  const openList = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      setItems(list => list.map(n => ({ ...n, isRead: true })));
      markAllRead().catch(() => {});
    }
  };

  // Clears this person's own list; a gym-wide notice stays for everyone else
  const clearAll = async () => {
    const previous = items;
    setItems([]);
    try { await removeAll(); } catch { setItems(previous); }
  };

  const dismiss = async (id) => {
    const previous = items;
    setItems(list => list.filter(n => n.id !== id));
    try { await removeNotif(id); } catch { setItems(previous); }
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={openList}
        aria-label={t('header.notifications')}
        style={{
          position: 'relative', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: 10, width: 38, height: 38, cursor: 'pointer', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6, minWidth: 8, height: 8,
            borderRadius: 4, background: 'var(--accent-red)', border: '1.5px solid var(--bg-elevated)',
          }} />
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', zIndex: 400, width: 320, maxHeight: 400,
          overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: 'var(--shadow-elevated)',
        }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>{t('header.notifications')}</span>
            {items.length > 0 && (
              <button type="button" data-clear-all onClick={clearAll}
                style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
                {t('header.clearAll')}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '26px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
              {t('header.noNotifications')}
            </div>
          ) : items.slice(0, 20).map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 8, padding: '11px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div
                style={{ flex: 1, minWidth: 0, cursor: onOpenLink ? 'pointer' : 'default' }}
                onClick={() => { if (onOpenLink) { dismiss(n.id); onOpenLink(resolveRoute(n)); setOpen(false); } }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{n.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginTop: 2, lineHeight: 1.45 }}>{n.body}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 4 }}>{ago(n.createdAt, t)}</div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(n.id)}
                aria-label={t('common.delete')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, alignSelf: 'flex-start' }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
