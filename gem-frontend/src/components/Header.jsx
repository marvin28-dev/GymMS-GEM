import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Settings, LogOut, User, Trash2 } from 'lucide-react';
import { getAll as getNotifs, markAllRead as apiMarkAllRead } from '../services/notifications.service';
import { getAuth, clearAuth } from '../utils/auth';

function formatRole(role) {
  if (!role) return 'Manager';
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatNotifTime(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Header() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);

  const authUser = getAuth()?.user || {};
  const firstName = authUser.firstName || '';
  const lastName = authUser.lastName || '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Manager';
  const initials = ([firstName[0], lastName[0]].filter(Boolean).join('') || 'ME').toUpperCase();
  const roleLabel = formatRole(authUser.role);
  const staffId = authUser.id;
  const [expandNotifs, setExpandNotifs] = useState(false);

  useEffect(() => {
    getNotifs()
      .then(res => setNotifs((res.data || []).map(n => ({
        ...n,
        unread: !n.isRead,
        text: n.body,
        time: formatNotifTime(n.createdAt),
      }))))
      .catch(() => {});
  }, []);

  const notifsRef = useRef(null);
  const avatarRef = useRef(null);

  const unreadCount = notifs.filter(n => n.unread).length;

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (notifsRef.current && !notifsRef.current.contains(e.target)) { setShowNotifs(false); setExpandNotifs(false); }
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setShowAvatar(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllRead = async () => {
    try { await apiMarkAllRead(); } catch (_) {}
    setNotifs(n => n.map(x => ({ ...x, unread: false })));
  };
  const clearAll = () => setNotifs([]);

  const NOTIF_ICONS = {
    membership: '🔔',
    inventory: '📦',
    task: '✅',
    signup: '👤',
  };

  const NOTIF_ROUTES = {
    membership: '/members',
    inventory: '/sales',
    task: '/tasks',
    signup: '/members',
  };

  const dismissNotif = (id) => setNotifs(prev => prev.filter(x => x.id !== id));

  const handleNotifClick = (n) => {
    dismissNotif(n.id);
    setShowNotifs(false);
    setExpandNotifs(false);
    navigate(NOTIF_ROUTES[n.type] || '/dashboard');
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        height: 64,
        background: 'rgba(10,10,15,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        flexShrink: 0,
      }}
    >
      {/* Left spacer */}
      <div />

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

        {/* Bell */}
        <div ref={notifsRef} style={{ position: 'relative' }}>
          <div
            onClick={() => { setShowNotifs(v => !v); setShowAvatar(false); }}
            style={{ position: 'relative', cursor: 'pointer', padding: 4, borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Bell size={18} color="var(--text-secondary)" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--accent-red)',
                  border: '1.5px solid rgba(10,10,15,0.8)',
                }}
              />
            )}
          </div>

          {/* Notifications dropdown */}
          {showNotifs && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 12px)',
                right: 0,
                width: 320,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                zIndex: 999,
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span style={{
                      background: 'var(--accent-red)', color: '#fff',
                      fontSize: 10, fontWeight: 700, borderRadius: 10,
                      padding: '1px 6px', lineHeight: 1.6,
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, color: 'var(--accent-gold)', fontFamily: 'DM Sans',
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Items */}
              <div style={{ maxHeight: expandNotifs ? 520 : 280, overflowY: 'auto', transition: 'max-height 0.25s ease' }}>
                {notifs.length === 0 && (
                  <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
                    No notifications
                  </div>
                )}
                {notifs.map(n => (
                  <div
                    key={n.id}
                    style={{
                      display: 'flex', gap: 12, padding: '12px 16px',
                      background: n.unread ? 'var(--accent-gold-glow)' : 'transparent',
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = n.unread ? 'var(--accent-gold-glow)' : 'transparent')}
                  >
                    {/* Clickable main area → navigate + dismiss */}
                    <div
                      onClick={() => handleNotifClick(n)}
                      style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                        {NOTIF_ICONS[n.type] || '🔔'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, color: n.unread ? 'var(--text-primary)' : 'var(--text-secondary)',
                          lineHeight: 1.4, fontFamily: 'DM Sans',
                          fontWeight: n.unread ? 500 : 400,
                        }}>
                          {n.text}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{n.time}</div>
                      </div>
                      {n.unread && (
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: 'var(--accent-gold)', flexShrink: 0, marginTop: 5,
                        }} />
                      )}
                    </div>

                    {/* Trash icon — dismiss only, no navigation */}
                    <button
                      onClick={e => { e.stopPropagation(); dismissNotif(n.id); }}
                      title="Dismiss"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '2px 4px', borderRadius: 4,
                        flexShrink: 0, display: 'flex', alignItems: 'center',
                        transition: 'color 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{
                padding: '10px 16px', borderTop: '1px solid var(--border-subtle)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent-gold)', fontFamily: 'DM Sans' }}
                  onClick={() => setExpandNotifs(v => !v)}
                >
                  {expandNotifs ? '↑ Show less' : '↓ See all notifications'}
                </button>
                {notifs.length > 0 && (
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}
                    onClick={clearAll}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div ref={avatarRef} style={{ position: 'relative' }}>
          <div
            onClick={() => { setShowAvatar(v => !v); setShowNotifs(false); }}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: showAvatar ? 'var(--accent-gold)' : 'var(--accent-gold-dim)',
              color: showAvatar ? '#0a0a0f' : 'var(--accent-gold)',
              fontWeight: 700,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--accent-gold)',
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {initials}
          </div>

          {/* Avatar dropdown */}
          {showAvatar && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 12px)',
                right: 0,
                width: 220,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                zIndex: 999,
              }}
            >
              {/* Profile info */}
              <div style={{
                padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)',
                  fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', border: '1px solid var(--accent-gold)',
                  flexShrink: 0, fontFamily: 'DM Sans',
                }}>
                  {initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans', lineHeight: 1.3 }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
                    {roleLabel}
                  </div>
                </div>
              </div>

              {/* Menu items */}
              {[
                { icon: User, label: 'My Profile', action: () => { navigate(`/staff/${staffId}`); setShowAvatar(false); } },
                { icon: Settings, label: 'Settings', action: () => { navigate('/settings'); setShowAvatar(false); } },
              ].map(({ icon: Icon, label, action }) => (
                <div
                  key={label}
                  onClick={action}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 16px', cursor: 'pointer',
                    color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'DM Sans',
                    transition: 'background 0.12s, color 0.12s',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <Icon size={14} strokeWidth={1.8} />
                  {label}
                </div>
              ))}

              {/* Sign out */}
              <div
                onClick={() => { clearAuth(); navigate('/login'); setShowAvatar(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 16px', cursor: 'pointer',
                  color: 'var(--accent-red)', fontSize: 13, fontFamily: 'DM Sans',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-red-dim)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <LogOut size={14} strokeWidth={1.8} />
                Sign Out
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
