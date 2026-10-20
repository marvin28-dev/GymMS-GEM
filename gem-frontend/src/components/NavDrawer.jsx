import { useNavigate, useLocation } from 'react-router-dom';
import {
  X, LayoutGrid, Users, CheckSquare, Calendar, Monitor,
  ClipboardList, ShoppingBag, Activity, CreditCard, BarChart3,
  Package, MessageSquare, Users2, Settings, Gem, LogOut,
} from 'lucide-react';
import { getAuth, clearAuth } from '../utils/auth';
import { pagesFor } from '../utils/rolePages';
import { useLanguage } from '../contexts/LanguageContext';
import { roleName } from '../utils/roleNames';

const DRAWER_SECTIONS = [
  {
    sectionKey: 'nav.sectionMain',
    items: [
      { labelKey: 'nav.dashboard', icon: LayoutGrid, path: '/dashboard' },
      { labelKey: 'nav.calendar', icon: Calendar, path: '/calendar' },
    ],
  },
  {
    sectionKey: 'nav.sectionMembers',
    items: [
      { labelKey: 'nav.members', icon: Users, path: '/members' },
      { labelKey: 'nav.packages', icon: Package, path: '/packages' },
      { labelKey: 'nav.communication', icon: MessageSquare, path: '/communication' },
    ],
  },
  {
    sectionKey: 'nav.sectionOperations',
    items: [
      { labelKey: 'nav.frontDesk', icon: Monitor, path: '/front-desk' },
      { labelKey: 'nav.attendance', icon: CheckSquare, path: '/attendance' },
      { labelKey: 'nav.operations', icon: Activity, path: '/operations' },
      { labelKey: 'nav.tasks', icon: ClipboardList, path: '/tasks' },
      { labelKey: 'nav.sales', icon: ShoppingBag, path: '/sales' },
    ],
  },
  {
    sectionKey: 'nav.sectionFinance',
    items: [
      { labelKey: 'nav.payments', icon: CreditCard, path: '/payments' },
      { labelKey: 'nav.accounting', icon: BarChart3, path: '/accounting' },
    ],
  },
  {
    sectionKey: 'nav.sectionAdmin',
    items: [
      { labelKey: 'nav.staff', icon: Users2, path: '/staff' },
      { labelKey: 'nav.settings', icon: Settings, path: '/settings' },
    ],
  },
];

export default function NavDrawer({ open, onClose }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const auth = getAuth();
  const authUser = auth?.user || {};
  const userRole = authUser.role || '';
  const roleProfile = pagesFor(userRole);
  const allowedPages = roleProfile ? roleProfile.pages : null;
  const firstName = authUser.firstName || '';
  const lastName = authUser.lastName || '';
  const initials = ([firstName[0], lastName[0]].filter(Boolean).join('') || 'ME').toUpperCase();

  const canSee = (path) => {
    if (!allowedPages) return true;
    const key = path.replace('/', '');
    return allowedPages.includes(key);
  };

  const go = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 398,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
          }}
        />
      )}

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '85%',
          maxWidth: 320,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          zIndex: 399,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '20px 16px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            gap: 10,
          }}
        >
          <Gem size={20} color="var(--accent-gold)" strokeWidth={2} />
          <span
            style={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 800,
              fontSize: 20,
              color: 'var(--accent-gold)',
              flex: 1,
            }}
          >
            GEM
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* User identity */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)',
              fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center',
              justifyContent: 'center', border: '1px solid var(--accent-gold)',
              flexShrink: 0, fontFamily: 'DM Sans',
            }}
          >
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>
              {[firstName, lastName].filter(Boolean).join(' ') || roleName(userRole, t)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
              {roleName(userRole, t)}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 8, paddingBottom: 16 }}>
          {DRAWER_SECTIONS.map((section) => {
            const visible = section.items.filter(i => canSee(i.path));
            if (!visible.length) return null;
            return (
              <div key={section.sectionKey}>
                <div
                  style={{
                    fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '2.5px', color: 'var(--text-muted)',
                    padding: '12px 20px 6px', fontFamily: 'DM Sans',
                  }}
                >
                  {t(section.sectionKey)}
                </div>
                {visible.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.path || pathname.startsWith(item.path + '/');
                  return (
                    <div
                      key={item.path}
                      onClick={() => go(item.path)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 20px', cursor: 'pointer',
                        background: active ? 'var(--accent-gold-dim)' : 'transparent',
                        color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
                        fontSize: 14, fontWeight: active ? 600 : 400,
                        fontFamily: 'DM Sans', borderRadius: 0,
                        position: 'relative',
                      }}
                    >
                      {active && (
                        <div
                          style={{
                            position: 'absolute', left: 0, top: '50%',
                            transform: 'translateY(-50%)', height: 22, width: 3,
                            background: 'var(--accent-gold)', borderRadius: '0 2px 2px 0',
                          }}
                        />
                      )}
                      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                      {t(item.labelKey)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Sign out */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            padding: '12px 0',
          }}
        >
          <div
            onClick={() => { clearAuth(); navigate('/login'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 20px', cursor: 'pointer',
              color: 'var(--accent-red)', fontSize: 14, fontFamily: 'DM Sans',
            }}
          >
            <LogOut size={17} strokeWidth={1.8} />
            {t('common.signOut')}
          </div>
        </div>
      </div>
    </>
  );
}
