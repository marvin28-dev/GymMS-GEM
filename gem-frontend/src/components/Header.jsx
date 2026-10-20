import { useState, useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useNavigate } from 'react-router-dom';
import { Bell, Settings, LogOut, User, Trash2, Menu, Gem } from 'lucide-react';
import { getAll as getNotifs, markAllRead as apiMarkAllRead, remove as removeNotif, removeAll as removeAllNotifs } from '../services/notifications.service';
import { getAuth, clearAuth, getRole } from '../utils/auth';
import { TASKS_PATH } from '../utils/rolePages';
import { useLanguage } from '../contexts/LanguageContext';
import { useSessionPhoto } from '../utils/sessionPhoto';
import GlobalSearch from './GlobalSearch';
import { roleName } from '../utils/roleNames';
import LoadFailed from './ui/LoadFailed';

const ROLE_KEYS = {
  general_manager: 'generalManager',
  manager: 'manager',
  trainer: 'trainer',
  instructor: 'instructor',
  front_desk: 'frontDesk',
  coach: 'coach',
  other: 'roleOther',
  accountant: 'accountant',
};

function formatNotifTime(iso, t) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t('common.justNow');
  if (mins < 60) return t('common.minsAgo', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('common.hoursAgo', { n: hrs });
  return t('common.daysAgoShort', { n: Math.floor(hrs / 24) });
}

export default function Header({ onMenuClick, isMobile: isMobileProp }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobileHook = useIsMobile();
  const isMobile = isMobileProp ?? isMobileHook;
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);

  const authUser = getAuth()?.user || {};
  const myPhoto = useSessionPhoto();
  const firstName = authUser.firstName || '';
  const lastName = authUser.lastName || '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || roleName(authUser.role, t);
  const initials = ([firstName[0], lastName[0]].filter(Boolean).join('') || 'ME').toUpperCase();
  const roleKey = ROLE_KEYS[authUser.role];
  const roleLabel = roleKey ? t(`staff.${roleKey}`) : roleName(authUser.role, t);
  const [expandNotifs, setExpandNotifs] = useState(false);
  const [notifsFailed, setNotifsFailed] = useState(false);

  // The header never unmounts, so fetching once on mount meant a new
  // notification only appeared after a full page reload.
  const refreshNotifs = useCallback(() => {
    getNotifs()
      .then(res => {
        setNotifs((res.data || []).map(n => ({
          ...n,
          unread: !n.isRead,
          text: n.body,
          time: formatNotifTime(n.createdAt, t),
        })));
        setNotifsFailed(false);
      })
      .catch(() => setNotifsFailed(true));
  }, [t]);

  useEffect(() => { refreshNotifs(); }, [refreshNotifs]);

  useEffect(() => {
    // Something this session did, such as assigning a task
    const onChanged = () => refreshNotifs();
    // Coming back to the tab after time away
    const onVisible = () => { if (!document.hidden) refreshNotifs(); };
    window.addEventListener('gem:data-changed', onChanged);
    document.addEventListener('visibilitychange', onVisible);

    // Some notifications are raised by the server with no user action at all,
    // such as a task falling due, so the header also polls.
    const poll = setInterval(() => { if (!document.hidden) refreshNotifs(); }, 60_000);

    return () => {
      window.removeEventListener('gem:data-changed', onChanged);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(poll);
    };
  }, [refreshNotifs]);

  const notifsRef = useRef(null);
  const avatarRef = useRef(null);

  const unreadCount = notifs.filter(n => n.unread).length;

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
  // These have to reach the server. Dropping them from local state alone meant
  // the next fetch brought every one of them straight back.
  const clearAll = async () => {
    const previous = notifs;
    setNotifs([]);
    try {
      await removeAllNotifs();
    } catch (err) {
      console.error('Failed to clear notifications:', err);
      setNotifs(previous);
    }
  };

  const NOTIF_ICONS = {
    membership: '🔔',
    inventory: '📦',
    task: '✅',
    signup: '👤',
    payment: '💳',
    system: '⚙️',
  };

  const dismissNotif = async (id) => {
    const previous = notifs;
    setNotifs(prev => prev.filter(x => x.id !== id));
    try {
      await removeNotif(id);
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
      setNotifs(previous);
    }
  };

  const resolveRoute = (n) => {
    // The server says where a notification points when it knows; the title
    // matching below is only a fallback for older ones.
    if (n.link) return n.link;
    const title = (n.title || '').toLowerCase();
    if (title.includes('payroll') || title.includes('paystub') || title.includes('pay issued') || title.includes('pay settled')) return '/accounting?tab=paystubs';
    if (title.includes('staff') || title.includes('employee') || title.includes('reactivated') || title.includes('deactivated')) return '/staff';
    if (title.includes('member') || title.includes('visitor') || title.includes('signup') || title.includes('enrolled') || title.includes('joined') || title.includes('registered')) return '/members';
    if (title.includes('payment') || title.includes('revenue') || title.includes('paid') || title.includes('received')) return '/payments';
    if (title.includes('task')) return TASKS_PATH(getRole());
    if (title.includes('finish')) return '/dashboard';
    if (title.includes('setup') || title.includes('profile') || title.includes('configure')) return '/settings';
    const typeMap = { signup: '/members', payment: '/payments', task: TASKS_PATH(getRole()), membership: '/members', system: '/settings' };
    return typeMap[n.type] || '/dashboard';
  };

  const handleNotifClick = (n) => {
    dismissNotif(n.id);
    setShowNotifs(false);
    setExpandNotifs(false);
    navigate(resolveRoute(n));
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        height: 64,
        background: 'var(--bg-header)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        zIndex: 210,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 16px' : '0 28px',
        flexShrink: 0,
      }}
    >
      {/* Logo - mobile only */}
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Gem size={18} color="var(--accent-gold)" strokeWidth={2} />
          <span
            style={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 18,
              color: 'var(--accent-gold)',
              letterSpacing: '-0.3px',
            }}
          >
            GEM
          </span>
        </div>
      )}

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>

        {/* Search - a button that opens a command-palette-style overlay */}
        <GlobalSearch compact={isMobile} />

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
                  border: '1.5px solid var(--bg-header)',
                }}
              />
            )}
          </div>

          {/* Notifications dropdown */}
          {showNotifs && (
            <div
              style={{
                position: isMobile ? 'fixed' : 'absolute',
                top: isMobile ? 64 : 'calc(100% + 12px)',
                right: isMobile ? 8 : 0,
                left: isMobile ? 8 : 'auto',
                width: isMobile ? 'auto' : 320,
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
                    {t('header.notifications')}
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
                    {t('header.markAllRead')}
                  </button>
                )}
              </div>

              {/* Items */}
              <div style={{ maxHeight: expandNotifs ? 520 : 280, overflowY: 'auto', transition: 'max-height 0.25s ease' }}>
                {notifs.length === 0 && notifsFailed && (
                  <div style={{ padding: 12 }}><LoadFailed message={t('notifications.loadFailed')} onRetry={refreshNotifs} /></div>
                )}
                {notifs.length === 0 && !notifsFailed && (
                  <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
                    {t('header.noNotifications')}
                  </div>
                )}
                {notifs.map(n => (
                  <div
                    key={n.id}
                    style={{
                      display: 'flex', gap: 12, padding: '12px 16px',
                      background: n.unread ? 'var(--accent-gold-glow)' : 'transparent',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                      {NOTIF_ICONS[n.type] || '🔔'}
                    </span>
                    <div onClick={() => handleNotifClick(n)} role="button" style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}>
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
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-gold)', marginTop: 5, flexShrink: 0 }} />
                    )}
                    <button
                      onClick={() => dismissNotif(n.id)}
                      title={t('header.dismiss')}
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
                  {expandNotifs ? `↑ ${t('header.showLess')}` : `↓ ${t('header.seeAll')}`}
                </button>
                {notifs.length > 0 && (
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}
                    onClick={clearAll}
                  >
                    {t('header.clearAll')}
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
              overflow: 'hidden',
            }}
          >
            {/* Their own photo if they have filed one, initials until then */}
            {myPhoto
              ? <img src={myPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : initials}
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
                { icon: User, labelKey: 'header.myProfile', action: () => { navigate('/my-profile'); setShowAvatar(false); } },
                authUser.role === 'general_manager' && { icon: Settings, labelKey: 'nav.settings', action: () => { navigate('/settings'); setShowAvatar(false); } },
              ].filter(Boolean).map(({ icon: Icon, labelKey, action }) => (
                <div
                  key={labelKey}
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
                  {t(labelKey)}
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
                {t('header.signOut')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
