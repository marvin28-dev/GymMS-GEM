import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, Users, ShoppingBag, MoreHorizontal, Calendar, ClipboardList, Monitor } from 'lucide-react';
import { Gem } from 'lucide-react';
import { getRole } from '../utils/auth';
import { useLanguage } from '../contexts/LanguageContext';

const CHECK_IN = { key: 'checkin', labelKey: 'nav.checkIn', icon: null, path: '/attendance', center: true };
const MORE     = { key: 'more',    labelKey: 'nav.more',    icon: MoreHorizontal, path: null };

const TAB_SETS = {
  front_desk: [
    { key: 'front-desk', labelKey: 'nav.frontDesk', icon: Monitor,      path: '/front-desk' },
    { key: 'members',    labelKey: 'nav.members',   icon: Users,         path: '/members' },
    CHECK_IN,
    { key: 'tasks',      labelKey: 'nav.tasks',     icon: ClipboardList, path: '/tasks' },
    MORE,
  ],
  // A coach doesn't check members in (the desk does), so no centre check-in button
  fitness: [
    { key: 'dashboard', labelKey: 'nav.home',     icon: LayoutGrid, path: '/dashboard' },
    { key: 'members',   labelKey: 'nav.members',  icon: Users,      path: '/members' },
    { key: 'calendar',  labelKey: 'nav.calendar', icon: Calendar,   path: '/calendar' },
    MORE,
  ],
  default: [
    { key: 'dashboard', labelKey: 'nav.home',       icon: LayoutGrid,  path: '/dashboard' },
    { key: 'members',   labelKey: 'nav.members',    icon: Users,       path: '/members' },
    CHECK_IN,
    { key: 'sales',     labelKey: 'nav.salesShort', icon: ShoppingBag, path: '/sales' },
    MORE,
  ],
};

function getTabs(role) {
  if (role === 'front_desk') return TAB_SETS.front_desk;
  if (role === 'trainer' || role === 'instructor' || role === 'coach') return TAB_SETS.fitness;
  return TAB_SETS.default;
}

export default function BottomTabBar({ onMoreClick }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const role = getRole();
  const tabs = getTabs(role);

  const isActive = (tab) => {
    if (!tab.path) return false;
    return pathname === tab.path || pathname.startsWith(tab.path + '/');
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 72,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 300,
        paddingBottom: 'env(safe-area-inset-bottom)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {tabs.map((tab) => {
        if (tab.center) {
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                position: 'relative',
                top: -16,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(201,169,110,0.45)',
                  border: '3px solid var(--bg-secondary)',
                }}
              >
                <Gem size={22} color="#0a0a0f" strokeWidth={2.2} />
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'DM Sans, sans-serif',
                  fontWeight: 600,
                  color: isActive(tab) ? 'var(--accent-gold)' : 'var(--text-muted)',
                  letterSpacing: '0.2px',
                  marginTop: -2,
                }}
              >
                {t(tab.labelKey)}
              </span>
            </button>
          );
        }

        const Icon = tab.icon;
        const active = isActive(tab);

        return (
          <button
            key={tab.key}
            onClick={() => tab.path ? navigate(tab.path) : onMoreClick?.()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 12px',
              minWidth: 56,
            }}
          >
            <Icon
              size={22}
              strokeWidth={active ? 2.2 : 1.8}
              color={active ? 'var(--accent-gold)' : 'var(--text-muted)'}
            />
            <span
              style={{
                fontSize: 10,
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--accent-gold)' : 'var(--text-muted)',
                letterSpacing: '0.2px',
              }}
            >
              {t(tab.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
