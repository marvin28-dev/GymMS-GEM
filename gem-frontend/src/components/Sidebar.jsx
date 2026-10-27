import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  Users,
  CheckSquare,
  Calendar,
  Monitor,
  ClipboardList,
  ShoppingBag,
  Activity,
  CreditCard,
  BarChart3,
  Package,
  MessageSquare,
  Users2,
  Settings,
  X,
} from 'lucide-react';
import { getAuth } from '../utils/auth';
import { pagesFor } from '../utils/rolePages';
import { roleName } from '../utils/roleNames';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getTasks } from '../services/tasks.service';
import { countMembersNeedingAttention, countTasksNeedingAttention } from '../utils/attention';
import { useLanguage } from '../contexts/LanguageContext';
import { useSetupStatus } from '../hooks/useSetupStatus';
import GemMark from './ui/GemMark';

const PATH_TO_NAV_KEY = {
  '/dashboard':    'dashboard',
  '/members':      'members',
  '/attendance':   'attendance',
  '/calendar':     'calendar',
  '/front-desk':   'frontDesk',
  '/tasks':        'tasks',
  '/sales':        'sales',
  '/operations':   'operations',
  '/payments':     'payments',
  '/accounting':   'accounting',
  '/packages':     'packages',
  '/communication':'communication',
  '/staff':        'staff',
  '/settings':     'settings',
};

const NAV_SECTIONS = [
  {
    title: 'MAIN',
    items: [
      { label: 'Dashboard', icon: LayoutGrid, path: '/dashboard' },
      { label: 'Calendar', icon: Calendar, path: '/calendar' },
    ],
  },
  {
    title: 'MEMBERS',
    items: [
      { label: 'Members', icon: Users, path: '/members', badgeKey: 'members' },
      { label: 'Packages', icon: Package, path: '/packages' },
      { label: 'Communication', icon: MessageSquare, path: '/communication' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Front Desk', icon: Monitor, path: '/front-desk' },
      { label: 'Attendance', icon: CheckSquare, path: '/attendance' },
      { label: 'Daily Overview', icon: Activity, path: '/operations' },
      { label: 'Tasks', icon: ClipboardList, path: '/tasks', badgeKey: 'tasks' },
      { label: 'Sales & Products', icon: ShoppingBag, path: '/sales' },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { label: 'Payments', icon: CreditCard, path: '/payments' },
      { label: 'Accounting', icon: BarChart3, path: '/accounting' },
    ],
  },
  {
    title: 'ADMIN',
    items: [
      { label: 'Staff', icon: Users2, path: '/staff' },
      { label: 'Settings', icon: Settings, path: '/settings' },
    ],
  },
];

function NavItem({ item, isActive, onClick, hasWarning }) {
  const { t } = useLanguage();
  const { label, icon: Icon, badge } = item;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      style={{
        border: 'none', width: 'calc(100% - 16px)', textAlign: 'left', boxSizing: 'border-box', lineHeight: 'inherit',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 8,
        margin: '2px 8px',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
        background: isActive ? 'var(--accent-gold-dim)' : 'transparent',
        color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)',
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        fontFamily: 'DM Sans, sans-serif',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--bg-card-hover)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {isActive && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            height: 20,
            width: 3,
            background: 'var(--accent-gold)',
            borderRadius: '0 2px 2px 0',
          }}
        />
      )}
      <Icon size={16} strokeWidth={1.8} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && (
        <span
          title={t('common.needsAttention')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--accent-yellow-dim)',
            color: 'var(--accent-yellow)',
            fontSize: 10,
            padding: '2px 7px',
            borderRadius: 10,
            marginLeft: 'auto',
            fontWeight: 700,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-yellow)' }} />
          {badge}
        </span>
      )}
      {hasWarning && (
        <span
          title={t('settings.setupRequired')}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent-gold)',
            flexShrink: 0,
            animation: 'gem-dot-pulse 1.5s ease-in-out infinite',
          }}
        />
      )}
    </button>
  );
}

// A dot sits on each setup step still to be done, and goes once it is done.
function setupWarningsFrom(setup) {
  if (!setup || setup.complete) return [];
  return [
    !setup.items.settings && '/settings',
    !setup.items.packages && '/packages',
    !setup.items.staff && '/staff',
  ].filter(Boolean);
}

export default function Sidebar({ open, onClose, isMobile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [badges, setBadges] = useState({ members: null, tasks: null });
  const setupWarnings = setupWarningsFrom(useSetupStatus());

  // The sidebar stays mounted for the whole session, so the counts have to be
  // refreshed on navigation and whenever a page reports a change. Fetching once
  // on mount leaves a deleted task showing in the badge indefinitely.
  // The badge is a count of what NEEDS ATTENTION, not a total - members lapsing
  // or owing, tasks waiting or overdue - so a number by a nav item always means
  // "there is something here to deal with", and is hidden when there is nothing.
  const refreshBadges = useCallback(() => {
    // Only what the counts read: a few fields per member and the open tasks (F-099)
    getMembers({ view: 'attention' }).then(res => setBadges(b => ({ ...b, members: countMembersNeedingAttention(res.data || []) }))).catch(() => {});
    getTasks({ open: 1 }).then(res => setBadges(b => ({ ...b, tasks: countTasksNeedingAttention(res.data || []) }))).catch(() => {});
  }, []);

  useEffect(() => { refreshBadges(); }, [location.pathname, refreshBadges]);

  useEffect(() => {
    const onChanged = () => refreshBadges();
    window.addEventListener('gem:data-changed', onChanged);
    return () => window.removeEventListener('gem:data-changed', onChanged);
  }, [refreshBadges]);

  const auth = getAuth();
  const authUser = auth?.user || {};
  const userRole = authUser.role || '';
  const roleProfile = pagesFor(userRole);
  const roleLabel = roleName(userRole, t);
  const allowedPages = roleProfile ? roleProfile.pages : null; // null = all access

  const canSee = (path) => {
    if (!allowedPages) return true;
    const key = path.replace('/', '').replace('/','');
    return allowedPages.includes(key);
  };

  return (
    <div
      data-tour="sidebar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 260,
        height: '100vh',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 220,
        transform: isMobile ? (open ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          // Matches the Header's 64px so both bottom rules form one line
          height: 64,
          flexShrink: 0,
          padding: '0 20px',
          borderBottom: '1px solid var(--border-subtle)',
          // The sidebar is what scrolls, so the brand has to be pinned to its
          // top the way the header is pinned to the top of the page. It needs
          // its own background, or the nav would slide underneath it.
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'var(--bg-secondary)',
        }}
      >
        <GemMark size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 19,
              color: 'var(--accent-gold)',
              letterSpacing: '-0.5px',
              lineHeight: 1.1,
            }}
          >
            GEM
          </div>
          <div
            style={{
              fontSize: 9.5,
              lineHeight: 1.2,
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            GymElite Manager
          </div>
        </div>
        {/* Close button - mobile only */}
        {isMobile && (
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={(e) => { e.stopPropagation(); onClose?.(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav sections */}
      <nav style={{ flex: 1, paddingTop: 8 }}>
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => canSee(item.path));
          if (visibleItems.length === 0) return null;
          const sectionTitleKeys = { MAIN: 'nav.sectionMain', MEMBERS: 'nav.sectionMembers', OPERATIONS: 'nav.sectionOperations', FINANCE: 'nav.sectionFinance', ADMIN: 'nav.sectionAdmin' };
          return (
            <div key={section.title}>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2.5px', color: 'var(--text-muted)', padding: '12px 20px 6px', fontFamily: 'DM Sans, sans-serif' }}>
                {t(sectionTitleKeys[section.title] || section.title)}
              </div>
              {visibleItems.map(item => {
                const navKey = PATH_TO_NAV_KEY[item.path];
                const translatedLabel = navKey ? t(`nav.${navKey}`) : item.label;
                return (
                  <NavItem
                    key={item.path}
                    item={{ ...item, label: translatedLabel, badge: item.badgeKey ? badges[item.badgeKey] : item.badge }}
                    isActive={location.pathname === item.path || location.pathname.startsWith(item.path + '/')}
                    hasWarning={setupWarnings.includes(item.path)}
                    onClick={() => { navigate(item.path); onClose?.(); }}
                  />
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          marginTop: 'auto',
          padding: 16,
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--accent-gold-dim)',
            color: 'var(--accent-gold)',
            fontWeight: 700,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {([authUser.firstName?.[0], authUser.lastName?.[0]].filter(Boolean).join('') || 'ME').toUpperCase()}
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontFamily: 'DM Sans, sans-serif',
              lineHeight: 1.3,
            }}
          >
            {[authUser.firstName, authUser.lastName].filter(Boolean).join(' ') || roleLabel}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'DM Sans, sans-serif',
              lineHeight: 1.3,
            }}
          >
            {roleLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
