import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Gem,
  LayoutGrid,
  Users,
  CheckSquare,
  Calendar,
  Monitor,
  ClipboardList,
  ShoppingBag,
  Flag,
  CreditCard,
  BarChart3,
  Package,
  MessageSquare,
  Users2,
  Settings,
} from 'lucide-react';
import { getAuth } from '../utils/auth';
import { ROLE_PROFILES } from '../data/mockData';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getTasks } from '../services/tasks.service';
import { useLanguage } from '../contexts/LanguageContext';

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
  '/accounting':   'reports',
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
      { label: 'Members', icon: Users, path: '/members', badgeKey: 'members' },
      { label: 'Attendance', icon: CheckSquare, path: '/attendance' },
      { label: 'Calendar', icon: Calendar, path: '/calendar' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Front Desk', icon: Monitor, path: '/front-desk' },
      { label: 'Tasks', icon: ClipboardList, path: '/tasks', badgeKey: 'tasks' },
      { label: 'Sales & Products', icon: ShoppingBag, path: '/sales' },
      { label: 'Operations', icon: Flag, path: '/operations' },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { label: 'Payments', icon: CreditCard, path: '/payments' },
      { label: 'Reports', icon: BarChart3, path: '/accounting' },
      { label: 'Packages', icon: Package, path: '/packages' },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { label: 'Communication', icon: MessageSquare, path: '/communication' },
      { label: 'Staff', icon: Users2, path: '/staff' },
      { label: 'Settings', icon: Settings, path: '/settings' },
    ],
  },
];

function NavItem({ item, isActive, onClick }) {
  const { label, icon: Icon, badge } = item;

  return (
    <div
      onClick={onClick}
      style={{
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
      {badge && (
        <span
          style={{
            background: 'var(--accent-gold-dim)',
            color: 'var(--accent-gold)',
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 10,
            marginLeft: 'auto',
            fontWeight: 600,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [badges, setBadges] = useState({ members: null, tasks: null });

  useEffect(() => {
    getMembers().then(res => setBadges(b => ({ ...b, members: (res.data || []).length }))).catch(() => {});
    getTasks().then(res => setBadges(b => ({ ...b, tasks: (res.data || []).filter(t => t.status !== 'done').length }))).catch(() => {});
  }, []);

  const auth = getAuth();
  const authUser = auth?.user || {};
  const userRole = authUser.role || 'general_manager';
  const roleProfile = ROLE_PROFILES.find(r => r.id === userRole);
  const allowedPages = roleProfile ? roleProfile.pages : null; // null = all access

  const canSee = (path) => {
    if (!allowedPages) return true;
    const key = path.replace('/', '').replace('/','');
    return allowedPages.includes(key);
  };

  return (
    <div
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
        zIndex: 200,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 20,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <Gem size={22} color="var(--accent-gold)" strokeWidth={2} />
        <span
          style={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: 22,
            color: 'var(--accent-gold)',
            letterSpacing: '-0.5px',
          }}
        >
          GEM
        </span>
      </div>

      {/* Nav sections */}
      <nav style={{ flex: 1, paddingTop: 8 }}>
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => canSee(item.path));
          if (visibleItems.length === 0) return null;
          const sectionTitleMap = { MAIN: t('nav.dashboard') !== 'dashboard' ? 'MAIN' : 'MAIN', OPERATIONS: 'OPERATIONS', FINANCE: 'FINANCE', SYSTEM: 'SYSTEM' };
          return (
            <div key={section.title}>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '2.5px', color: 'var(--text-muted)', padding: '12px 20px 6px', fontFamily: 'DM Sans, sans-serif' }}>
                {section.title}
              </div>
              {visibleItems.map(item => {
                const navKey = PATH_TO_NAV_KEY[item.path];
                const translatedLabel = navKey ? t(`nav.${navKey}`) : item.label;
                return (
                  <NavItem
                    key={item.path}
                    item={{ ...item, label: translatedLabel, badge: item.badgeKey ? badges[item.badgeKey] : item.badge }}
                    isActive={location.pathname === item.path || location.pathname.startsWith(item.path + '/')}
                    onClick={() => navigate(item.path)}
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
            {[authUser.firstName, authUser.lastName].filter(Boolean).join(' ') || 'Manager'}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'DM Sans, sans-serif',
              lineHeight: 1.3,
            }}
          >
            {roleProfile?.name || 'Manager'}
          </div>
        </div>
      </div>
    </div>
  );
}
