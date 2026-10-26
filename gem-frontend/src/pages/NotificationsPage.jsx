import { useLiveTick } from '../hooks/useLiveRefresh';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, CreditCard, ClipboardList, Package, Settings, Bell, Trash2, Check, Eye } from 'lucide-react';
import RowMenu from '../components/ui/RowMenu';
import { getAll as getNotifications, markAllRead as apiMarkAllRead, markOneRead as apiMarkOneRead, remove as apiRemoveNotif, removeAll as apiRemoveAll } from '../services/notifications.service';
import { useIsMobile } from '../hooks/useIsMobile';
import { getRole } from '../utils/auth';
import { TASKS_PATH } from '../utils/rolePages';
import { useLanguage } from '../contexts/LanguageContext';
import { SkeletonCards, SkeletonList } from '../components/Skeleton';

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
const FITNESS_CATEGORIES = ['All', 'Task'];

const CATEGORY_KEYS = {
  All: 'notifications.catAll',
  Membership: 'notifications.catMembership',
  Payment: 'notifications.catPayment',
  Task: 'notifications.catTask',
  Inventory: 'notifications.catInventory',
  System: 'notifications.catSystem',
};

function resolveNotifLink(n) {
  // The server says where a notification points when it knows; the title
  // matching below is only a fallback for older ones.
  if (n.link) return n.link;
  const title = (n.title || '').toLowerCase();
  if (title.includes('payroll') || title.includes('paystub') || title.includes('pay issued') || title.includes('pay settled')) return '/accounting?tab=paystubs';
  if (title.includes('staff') || title.includes('employee') || title.includes('reactivated') || title.includes('deactivated')) return '/staff';
  if (title.includes('member') || title.includes('visitor') || title.includes('signup') || title.includes('enrolled') || title.includes('joined') || title.includes('registered')) return '/members';
  if (title.includes('payment') || title.includes('revenue') || title.includes('paid') || title.includes('received')) return '/payments';
  if (title.includes('task') || title.includes('maintenance') || title.includes('issue') || title.includes('review')) return TASKS_PATH(getRole());
  if (title.includes('finish')) return '/dashboard';
  if (title.includes('setup') || title.includes('profile') || title.includes('configure')) return '/settings';
  const typeMap = { signup: '/members', payment: '/payments', task: TASKS_PATH(getRole()), membership: '/members', system: '/settings' };
  // Never a dead end - everything at least lands on the dashboard.
  return typeMap[n.type] || '/dashboard';
}

function formatTime(iso, t) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t('common.justNow');
  if (mins < 60) return t('common.minsAgo', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('common.hoursAgo', { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days === 1) return t('common.yesterday');
  return t('common.daysAgoLong', { n: days });
}

export default function NotificationsPage() {
  const { t } = useLanguage();
  const nav = useNavigate();
  const isMobile = useIsMobile();
  const isFitnessRole = ['trainer', 'instructor', 'coach'].includes(getRole());
  const [notifs, setNotifs] = useState([]);

  // A list that could not be loaded says so, rather than "No notifications";
  // a refused change says so, rather than happening on screen only (F-102, F-107)
  const [loadError, setLoadError] = useState(false);
  // Until the list has come back nothing is said about it: it used to read
  // "No notifications, all caught up" while it was still on its way
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const failed = (err) => setActionError(err?.response?.data?.error || t('memberProfile.actionFailed'));
  const liveTick = useLiveTick();
  useEffect(() => {
    getNotifications()
      .then(res => {
        setLoadError(false);
        setNotifs((res.data || []).map(n => ({
          ...n,
          unread: !n.isRead,
          text: n.body,
        })));
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [liveTick]);
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = notifs.filter(n => {
    if (activeCategory === 'All') return true;
    const map = { Membership: 'membership', Payment: 'payment', Task: 'task', Inventory: 'inventory', System: 'system' };
    return n.type === map[activeCategory] || n.type === 'signup' && activeCategory === 'Membership';
  });

  const unreadCount = notifs.filter(n => n.unread).length;

  const markRead = async (id) => {
    setActionError('');
    try {
      await apiMarkOneRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
    } catch (err) { failed(err); }
  };
  const markAllRead = async () => {
    setActionError('');
    try {
      await apiMarkAllRead();
      setNotifs(prev => prev.map(n => ({ ...n, unread: false })));
    } catch (err) { failed(err); }
  };
  // Clears this person's own list; a gym-wide notice stays for everyone else
  const clearAll = async () => {
    const previous = notifs;
    setActionError('');
    setNotifs([]);
    try { await apiRemoveAll(); } catch (err) { setNotifs(previous); failed(err); }
  };
  const deleteNotif = async (id) => {
    setActionError('');
    try {
      await apiRemoveNotif(id);
      setNotifs(prev => prev.filter(n => n.id !== id));
    } catch (err) { failed(err); }
  };
  const problem = actionError || (loadError ? t('notifications.loadFailed') : '');
  const problemBox = problem ? (
    <div role="alert" style={{ marginBottom: 14, fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans' }}>{problem}</div>
  ) : null;

  const handleNotifClick = (n) => {
    if (n.unread) markRead(n.id);
    const link = resolveNotifLink(n);
    if (link) nav(link);
  };

  const chipStyle = (active) => ({
    padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans', border: 'none',
    background: active ? 'var(--accent-gold-dim)' : 'transparent',
    color: active ? 'var(--accent-gold)' : 'var(--text-muted)',
    borderWidth: 1, borderStyle: 'solid',
    borderColor: active ? 'var(--accent-gold)' : 'transparent',
  });

  if (isMobile) {
    return (
      <div style={{ padding: '16px 16px 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {t('notifications.title')}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'DM Sans' }}>
              {loading ? t('common.loading') : unreadCount > 0 ? t('notifications.unread', { count: unreadCount }) : t('notifications.allCaughtUp')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={13} /> {t('notifications.markAllRead')}
              </button>
            )}
            {notifs.length > 0 && (
              <button data-clear-all onClick={clearAll} aria-label={t('header.clearAll')} title={t('header.clearAll')} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {problemBox}
        {/* Category chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12, scrollbarWidth: 'none' }}>
          {(isFitnessRole ? FITNESS_CATEGORIES : CATEGORIES).map(c => {
            const active = activeCategory === c;
            return (
              <button key={c} onClick={() => setActiveCategory(c)} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: `1px solid ${active ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: active ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)', color: active ? 'var(--accent-gold)' : 'var(--text-muted)', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'DM Sans', WebkitTapHighlightColor: 'transparent' }}>
                {t(CATEGORY_KEYS[c])}
              </button>
            );
          })}
        </div>

        {/* Notification list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
          {filtered.length === 0 ? (loadError ? null : loading ? <SkeletonCards count={4} /> :
            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
              <Bell size={36} color="var(--text-muted)" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginBottom: 6 }}>
                {t('notifications.noNotifications')}
              </div>
              {isFitnessRole && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', lineHeight: 1.6 }}>
                  {t('notifications.fitnessEmpty')}
                </div>
              )}
            </div>
          ) : filtered.map(n => {
            const tc = TYPE_ICONS[n.type] || TYPE_ICONS.system;
            const IconComp = tc.icon;
            const link = resolveNotifLink(n);
            return (
              <div key={n.id} onClick={() => handleNotifClick(n)} style={{ background: n.unread ? 'var(--accent-gold-glow)' : 'var(--bg-card)', border: `1px solid ${n.unread ? 'var(--accent-gold-dim)' : 'var(--border-subtle)'}`, borderRadius: 12, padding: '13px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: link ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <IconComp size={16} color={tc.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    {n.unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-gold)', flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, fontWeight: n.unread ? 600 : 500, color: 'var(--text-primary)', fontFamily: 'DM Sans', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{formatTime(n.createdAt, t)}</div>
                </div>
                <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <RowMenu title={t('common.actions')} items={[
                    { label: t('common.view'), icon: <Eye size={15} />, onClick: () => handleNotifClick(n), hidden: !link },
                    { label: t('notifications.markRead'), icon: <Check size={15} />, onClick: () => markRead(n.id), hidden: !n.unread },
                    { label: t('common.delete'), icon: <Trash2 size={15} />, onClick: () => deleteNotif(n.id), danger: true },
                  ]} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('notifications.title')}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {loading ? t('common.loading') : unreadCount > 0 ? t('notifications.unreadPlural', { count: unreadCount }) : t('notifications.allCaughtUp')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <button style={secondaryBtn} onClick={markAllRead}>
              <Check size={12} style={{ marginRight: 4 }} />{t('notifications.markAllRead')}
            </button>
          )}
          {notifs.length > 0 && (
            <button data-clear-all style={secondaryBtn} onClick={clearAll}>
              <Trash2 size={12} style={{ marginRight: 4 }} />{t('header.clearAll')}
            </button>
          )}
        </div>
      </div>

      {problemBox}
      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-elevated)', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        {(isFitnessRole ? FITNESS_CATEGORIES : CATEGORIES).map(c => (
          <button key={c} style={chipStyle(activeCategory === c)} onClick={() => setActiveCategory(c)}>
            {t(CATEGORY_KEYS[c])}
          </button>
        ))}
      </div>

      <div style={cardStyle}>
        {filtered.length === 0 ? (loadError ? null : loading ? <SkeletonList rows={4} /> :
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Bell size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {t('notifications.noNotifications')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {isFitnessRole ? t('notifications.fitnessEmpty') : t('notifications.categoryEmpty')}
            </div>
          </div>
        ) : (
          filtered.map((n, idx) => {
            const tc = TYPE_ICONS[n.type] || TYPE_ICONS.system;
            const IconComp = tc.icon;
            const link = resolveNotifLink(n);
            return (
              <div
                key={n.id}
                onClick={() => handleNotifClick(n)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  background: n.unread ? 'var(--accent-gold-glow)' : 'transparent',
                  cursor: link ? 'pointer' : 'default', transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = n.unread ? 'rgba(201,169,110,0.1)' : 'var(--bg-card-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = n.unread ? 'var(--accent-gold-glow)' : 'transparent'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <IconComp size={16} color={tc.color} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
                    {n.unread && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-gold)', flexShrink: 0 }} />
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{n.text}</p>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>{formatTime(n.createdAt, t)}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <div onClick={e => e.stopPropagation()}>
                    <RowMenu title={t('common.actions')} items={[
                      { label: t('common.view'), icon: <Eye size={15} />, onClick: () => handleNotifClick(n), hidden: !link },
                      { label: t('notifications.markRead'), icon: <Check size={15} />, onClick: () => markRead(n.id), hidden: !n.unread },
                      { label: t('common.delete'), icon: <Trash2 size={15} />, onClick: () => deleteNotif(n.id), danger: true },
                    ]} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
