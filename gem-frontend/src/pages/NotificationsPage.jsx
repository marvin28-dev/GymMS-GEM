import { useState, useEffect } from 'react';
import { User, CreditCard, ClipboardList, Package, Settings, Bell, Trash2, Check } from 'lucide-react';
import { getAll as getNotifications, markAllRead as apiMarkAllRead, markOneRead as apiMarkOneRead, remove as apiRemoveNotif } from '../services/notifications.service';

function formatTime(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const secondaryBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', fontFamily: 'DM Sans' };

const TYPE_ICONS = {
  membership: { icon: User, color: 'var(--accent-gold)', bg: 'var(--accent-gold-dim)' },
  payment: { icon: CreditCard, color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
  task: { icon: ClipboardList, color: 'var(--accent-purple)', bg: 'var(--accent-purple-dim)' },
  inventory: { icon: Package, color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' },
  system: { icon: Settings, color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' },
  signup: { icon: User, color: 'var(--accent-gold)', bg: 'var(--accent-gold-dim)' },
};

const CATEGORIES = ['All', 'Membership', 'Payment', 'Task', 'Inventory', 'System'];

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    getNotifications()
      .then(res => setNotifs((res.data || []).map(n => ({
        ...n,
        unread: !n.isRead,
        text: n.body,
        time: formatTime(n.createdAt),
      }))))
      .catch(console.error);
  }, []);
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = notifs.filter(n => {
    if (activeCategory === 'All') return true;
    const map = { Membership: 'membership', Payment: 'payment', Task: 'task', Inventory: 'inventory', System: 'system' };
    return n.type === map[activeCategory] || n.type === 'signup' && activeCategory === 'Membership';
  });

  const unreadCount = notifs.filter(n => n.unread).length;

  const markRead = async (id) => {
    try { await apiMarkOneRead(id); } catch (_) {}
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  };
  const markAllRead = async () => {
    try { await apiMarkAllRead(); } catch (_) {}
    setNotifs(prev => prev.map(n => ({ ...n, unread: false })));
  };
  const deleteNotif = async (id) => {
    try { await apiRemoveNotif(id); } catch (_) {}
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const chipStyle = (active) => ({
    padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans', border: 'none',
    background: active ? 'var(--accent-gold-dim)' : 'transparent',
    color: active ? 'var(--accent-gold)' : 'var(--text-muted)',
    borderWidth: 1, borderStyle: 'solid',
    borderColor: active ? 'var(--accent-gold)' : 'transparent',
  });

  return (
    <div className="page-fade">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Notifications</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button style={secondaryBtn} onClick={markAllRead}>
            <Check size={12} style={{ marginRight: 4 }} />Mark All as Read
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-elevated)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        {CATEGORIES.map(c => (
          <button key={c} style={chipStyle(activeCategory === c)} onClick={() => setActiveCategory(c)}>{c}</button>
        ))}
      </div>

      <div style={cardStyle}>
        {filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Bell size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>No notifications</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>You have no notifications in this category.</div>
          </div>
        ) : (
          filtered.map((n, idx) => {
            const tc = TYPE_ICONS[n.type] || TYPE_ICONS.system;
            const IconComp = tc.icon;
            return (
              <div
                key={n.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  background: n.unread ? 'var(--accent-gold-glow)' : 'transparent',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!n.unread) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = n.unread ? 'var(--accent-gold-glow)' : 'transparent'; }}
              >
                {/* Icon */}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <IconComp size={16} color={tc.color} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
                    {n.unread && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-gold)', flexShrink: 0 }} />
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{n.text}</p>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>{n.time}</span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {n.unread && (
                    <button title="Mark as read" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'DM Sans' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-gold)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      onClick={e => { e.stopPropagation(); markRead(n.id); }}>
                      Mark read
                    </button>
                  )}
                  <button title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-red)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    onClick={e => { e.stopPropagation(); deleteNotif(n.id); }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
