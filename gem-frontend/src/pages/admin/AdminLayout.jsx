import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Receipt, Target, LifeBuoy, Megaphone, Settings, LogOut, Menu, X } from 'lucide-react';
import GemMark from '../../components/ui/GemMark';
import LangToggle from '../../components/LangToggle';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { isAdminAuthed, getAdminAuth, forgetAdminAuth } from '../../utils/adminAuth';
import { getCounts, logout } from '../../services/admin.service';

// GEM's admin dashboard: its own frame, apart from any gym's. A sidebar on a
// computer; on a phone a top bar whose menu opens the same list.
const NAV = [
  ['/admin', 'navOverview', LayoutDashboard, true],
  ['/admin/gyms', 'navGyms', Building2],
  ['/admin/billing', 'navBilling', Receipt],
  ['/admin/leads', 'navLeads', Target],
  ['/admin/problems', 'navProblems', LifeBuoy],
  ['/admin/announcements', 'navAnnouncements', Megaphone],
  ['/admin/settings', 'navSettings', Settings],
];

export default function AdminLayout() {
  const { t, lang, switchLang } = useLanguage();
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({});
  const authed = isAdminAuthed();

  // The badges: what is waiting, refreshed as the admin moves around
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    getCounts().then(r => {
      if (!alive) return;
      setCounts({ '/admin/problems': r.data.problems, '/admin/leads': r.data.leads, '/admin/billing': r.data.billing });
    }).catch(() => {});
    return () => { alive = false; };
  }, [pathname, authed]);

  if (!authed) return <Navigate to="/admin/login" replace />;

  const signOut = async () => {
    try { await logout(); } catch { /* signed out here either way */ }
    forgetAdminAuth();
    navigate('/admin/login', { replace: true });
  };

  const links = (
    <nav aria-label={t('admin.navLabel')} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {NAV.map(([to, key, Icon, end]) => (
        <NavLink key={to} to={to} end={!!end} data-admin-nav={key} onClick={() => setOpen(false)}
          style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, textDecoration: 'none', fontSize: 13.5, fontWeight: isActive ? 700 : 500, fontFamily: 'DM Sans, sans-serif', color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)', background: isActive ? 'var(--accent-gold-dim)' : 'transparent' })}>
          <Icon size={17} />
          <span style={{ flex: 1 }}>{t(`admin.${key}`)}</span>
          {counts[to] > 0 && <span data-nav-count style={{ minWidth: 20, height: 20, borderRadius: 10, padding: '0 6px', background: 'var(--accent-yellow)', color: 'var(--on-accent-gold)', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{counts[to]}</span>}
        </NavLink>
      ))}
    </nav>
  );

  const who = getAdminAuth()?.admin?.email || '';
  const footer = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', overflowWrap: 'anywhere' }}>{t('admin.signedInAs', { email: who })}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LangToggle lang={lang} switchLang={switchLang} />
        <button type="button" data-admin-signout onClick={signOut} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12.5, fontFamily: 'DM Sans, sans-serif' }}>
          <LogOut size={14} /> {t('admin.signOut')}
        </button>
      </div>
    </div>
  );

  const brand = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <GemMark size={30} />
      <div>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.1 }}>GEM</div>
        <div style={{ fontSize: 10.5, color: 'var(--accent-gold)', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' }}>{t('admin.brandSub')}</div>
      </div>
    </div>
  );

  return (
    <div data-admin style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
      {isMobile ? (
        <header style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--bg-header)', borderBottom: '1px solid var(--border-subtle)', backdropFilter: 'blur(16px)' }}>
          {brand}
          <button type="button" aria-label={t('admin.menu')} aria-expanded={open} onClick={() => setOpen(o => !o)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer' }}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </header>
      ) : (
        <aside style={{ width: 236, flexShrink: 0, position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box', padding: '20px 14px', borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {brand}
          <div style={{ flex: 1, overflowY: 'auto' }}>{links}</div>
          {footer}
        </aside>
      )}
      {isMobile && open && (
        <div data-admin-menu style={{ position: 'fixed', inset: '61px 0 0 0', zIndex: 49, background: 'var(--bg-primary)', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {links}
          {footer}
        </div>
      )}
      <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '16px 16px 40px' : '28px 32px 48px', boxSizing: 'border-box', maxWidth: isMobile ? '100%' : 1240 }}>
        <Outlet />
      </main>
    </div>
  );
}
