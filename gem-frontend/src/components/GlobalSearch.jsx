import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, LayoutGrid, Users, Package, MessageSquare, Monitor, CheckSquare,
  Activity, ClipboardList, ShoppingBag, CreditCard, BarChart3, Users2,
  Settings as SettingsIcon, Calendar, User, X, UserCircle, Ticket,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getRole } from '../utils/auth';
import { pagesFor } from '../utils/rolePages';
import { softAll } from '../utils/loadAll';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getStaff } from '../services/staff.service';
import { getAll as getPackages } from '../services/packages.service';

// Everywhere the search can take you: a page, a Settings section, or your own
// profile. Each carries the page it belongs to so the list only ever offers
// what this role may open. `kw` is the words people type for what lives there
// but is not in the label ("freeze" for Members, "finance" for Accounting).
const PAGE_DESTS = [
  { page: 'dashboard', path: '/dashboard', icon: LayoutGrid, labelKey: 'nav.dashboard', kw: 'home overview summary today' },
  { page: 'calendar', path: '/calendar', icon: Calendar, labelKey: 'nav.calendar', kw: 'schedule events classes diary invite agenda' },
  { page: 'members', path: '/members', icon: Users, labelKey: 'nav.members', kw: 'clients visitors freeze unfreeze frozen renew renewal extend cancel membership reactivate day pass convert visitor check-in code balance debt owing' },
  { page: 'packages', path: '/packages', icon: Package, labelKey: 'nav.packages', kw: 'plans pricing bundles visitor bundle day pass price sessions duration validity' },
  { page: 'communication', path: '/communication', icon: MessageSquare, labelKey: 'nav.communication', kw: 'message email sms announce bulk broadcast' },
  { page: 'front-desk', path: '/front-desk', icon: Monitor, labelKey: 'nav.frontDesk', kw: 'check in kiosk reception register walk in quick expense' },
  { page: 'attendance', path: '/attendance', icon: CheckSquare, labelKey: 'nav.attendance', kw: 'check in checkout log visits history day pass heatmap busiest' },
  { page: 'operations', path: '/operations', icon: Activity, labelKey: 'nav.operations', kw: 'daily overview issues equipment maintenance end of day eod report' },
  { page: 'tasks', path: '/tasks', icon: ClipboardList, labelKey: 'nav.tasks', kw: 'todo assignments approvals requests' },
  { page: 'sales', path: '/sales', icon: ShoppingBag, labelKey: 'nav.salesShort', kw: 'products shop stock inventory restock sell' },
  { page: 'payments', path: '/payments', icon: CreditCard, labelKey: 'nav.payments', kw: 'revenue receipts money refund balance debt owe transaction reference' },
  { page: 'accounting', path: '/accounting', icon: BarChart3, labelKey: 'nav.accounting', kw: 'finance expenses payroll paystub reports marketing profit review' },
  { page: 'staff', path: '/staff', icon: Users2, labelKey: 'nav.staff', kw: 'team employees roster access code deactivate trainer manager' },
  { page: 'settings', path: '/settings', icon: SettingsIcon, labelKey: 'nav.settings', kw: 'preferences configure setup' },
];

const SETTINGS_DESTS = [
  { page: 'settings', path: '/settings?section=gym-profile', labelKey: 'settings.gymProfile', kw: 'address phone email logo name gym code country city' },
  { page: 'settings', path: '/settings?section=appearance', labelKey: 'settings.appearance', kw: 'theme dark light colour color' },
  { page: 'settings', path: '/settings?section=language', labelKey: 'settings.language', kw: 'french english francais' },
  { page: 'settings', path: '/settings?section=payment', labelKey: 'settings.paymentSettings', kw: 'currency tax late fee methods cash card mobile money transfer expense limit' },
  { page: 'settings', path: '/settings?section=membership', labelKey: 'settings.membershipDefaults', kw: 'registration fee freeze freezing frozen fee auto renew renewal grace period minimum upfront deposit' },
  { page: 'settings', path: '/settings?section=packages', labelKey: 'settings.packageSettings', kw: 'access types' },
  { page: 'settings', path: '/settings?section=notifications', labelKey: 'settings.notificationPreferences', kw: 'alerts email welcome expiry reminders low stock overdue end of day eod' },
];

// Lower-case and drop accents, so "gele" finds "gelé" and "francais" finds "français".
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// People and packages are fetched once when search first opens and kept for a
// minute, so typing never waits on the network.
let recordCache = null;
let recordCacheAt = 0;
function loadRecords(allowed) {
  if (recordCache && Date.now() - recordCacheAt < 60000) return Promise.resolve(recordCache);
  const can = (p) => allowed === null || allowed.has(p);
  return softAll([
    can('members') ? getMembers() : null,
    can('staff') ? getStaff() : null,
    can('packages') ? getPackages() : null,
  ]).then(([m, s, p]) => {
    const list = (r) => (Array.isArray(r?.data) ? r.data : r?.data?.data || []);
    recordCache = { members: list(m), staff: list(s), packages: list(p) };
    recordCacheAt = Date.now();
    return recordCache;
  });
}

export default function GlobalSearch({ compact = false }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [records, setRecords] = useState(recordCache);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  const role = getRole();
  const allowedPages = useMemo(() => {
    const p = pagesFor(role)?.pages;
    return p === null ? null : new Set(p || []);
  }, [role]);

  useEffect(() => {
    if (open) loadRecords(allowedPages).then(setRecords).catch(() => {});
  }, [open, allowedPages]);

  const dests = useMemo(() => {
    const can = (d) => allowedPages === null || allowedPages.has(d.page);
    const pages = PAGE_DESTS.filter(can).map(d => ({ ...d, group: 'pages', label: t(d.labelKey) }));
    pages.push({ page: 'my-profile', path: '/my-profile', icon: User, group: 'pages', label: t('header.myProfile'), kw: 'account me password' });
    const settings = SETTINGS_DESTS.filter(can).map(d => ({ ...d, group: 'settings', icon: SettingsIcon, label: t(d.labelKey) }));
    return [...pages, ...settings];
  }, [allowedPages, t]);

  const results = useMemo(() => {
    const query = norm(q).trim();
    if (!query) return dests.filter(d => d.group === 'pages').slice(0, 6);
    const words = query.split(/\s+/);
    const hit = (...fields) => {
      const hay = norm(fields.join(' '));
      return words.every(w => hay.includes(w));
    };
    const found = dests.filter(d => hit(d.label, d.kw));
    const r = records || {};
    const members = (r.members || [])
      .filter(m => hit(m.firstName, m.lastName, m.memberCode, m.phone, m.email))
      .slice(0, 5)
      .map(m => ({
        group: 'members', icon: m.isVisitor ? Ticket : UserCircle, path: `/members/${m.id}`,
        label: `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        sub: [m.memberCode, m.isVisitor ? t('members.visitors') : m.package?.name].filter(Boolean).join(' · '),
      }));
    const staff = (r.staff || [])
      .filter(s => s.isActive !== false && hit(s.name, s.firstName, s.lastName, s.email, s.phone))
      .slice(0, 4)
      .map(s => ({
        group: 'staff', icon: Users2, path: `/staff/${s.id}`,
        label: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(), sub: s.email || '',
      }));
    const packages = (r.packages || [])
      .filter(p => p.isActive !== false && hit(p.name, p.code, p.isVisitor ? 'visitor bundle' : 'membership package'))
      .slice(0, 4)
      .map(p => ({ group: 'packages', icon: Package, path: '/packages', label: p.name, sub: p.code || '' }));
    return [...found.slice(0, 8), ...members, ...staff, ...packages];
  }, [q, dests, records, t]);

  useEffect(() => { setActive(0); }, [q]);

  // Open with the button/field, or Ctrl/Cmd+K from anywhere; close with Escape.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setOpen(true); setTimeout(() => inputRef.current?.focus(), 20); }
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The inline (desktop) field closes when you click away from it.
  useEffect(() => {
    if (compact) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [compact]);

  // The compact (mobile) button opens a centred overlay, so clear the query
  // each time it opens. The inline field keeps whatever you have typed.
  useEffect(() => {
    if (compact && open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 40); }
  }, [open, compact]);

  const go = (d) => { setOpen(false); setQ(''); navigate(d.path); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) go(results[active]); }
  };

  const GROUP_LABELS = {
    pages: t('search.groupPages'), settings: t('nav.settings'), members: t('nav.members'),
    staff: t('nav.staff'), packages: t('nav.packages'),
  };

  // The results list, shared by the inline dropdown and the overlay. A small
  // heading opens each group so a page, a setting and a person read apart.
  const resultsList = (
    results.length === 0 ? (
      <div style={{ padding: '22px 16px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans', textAlign: 'center' }}>
        {q.trim() ? t('search.nothingFor', { q: q.trim() }) : t('common.noResults')}
      </div>
    ) : results.map((d, i) => {
      const Icon = d.icon || SettingsIcon;
      const newGroup = i === 0 || results[i - 1].group !== d.group;
      return (
        <div key={`${d.group}:${d.path}:${d.label}`}>
          {newGroup && (
            <div style={{ padding: i === 0 ? '10px 14px 4px' : '12px 14px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
              {GROUP_LABELS[d.group]}
            </div>
          )}
          <div
            onMouseDown={(e) => { e.preventDefault(); go(d); }}
            onMouseEnter={() => setActive(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', margin: '0 4px',
              borderRadius: 8, cursor: 'pointer',
              background: i === active ? 'var(--bg-card-hover)' : 'transparent',
            }}
          >
            <Icon size={16} strokeWidth={1.8} color={i === active ? 'var(--accent-gold)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontFamily: 'DM Sans', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</div>
              {d.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.sub}</div>}
            </div>
          </div>
        </div>
      );
    })
  );

  // The floating results card: its own rounded border and shadow, set a little
  // below the field rather than glued to it, so no edges double up.
  const card = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12,
    boxShadow: '0 18px 48px rgba(0,0,0,0.35)', overflow: 'hidden',
  };

  // ── Desktop: a bare icon that smoothly opens into a field in place. Collapsed
  // it is just a 38px icon button (like the bell beside it); clicking or Ctrl/⌘K
  // grows it leftward into the empty header space - its right edge is pinned, so
  // the bell and avatar never move - and the results hang just beneath. ──
  if (!compact) {
    return (
      <div ref={wrapRef} style={{ position: 'relative', width: 38, height: 38 }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: open ? 380 : 38, height: 38, transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)', zIndex: open ? 1001 : 1 }}>
          <div
            onMouseDown={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
            title={!open ? `${t('common.searchEverything')} (Ctrl/⌘ K)` : undefined}
            aria-label={t('common.searchEverything')}
            style={{
              display: 'flex', alignItems: 'center', gap: open ? 8 : 0, height: 38, width: '100%', boxSizing: 'border-box',
              padding: open ? '0 12px' : 0, justifyContent: open ? 'flex-start' : 'center', borderRadius: 10,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              boxShadow: open ? '0 0 0 3px var(--accent-gold-dim)' : 'none',
              cursor: open ? 'text' : 'pointer', overflow: 'hidden', transition: 'box-shadow 0.2s, padding 0.2s',
            }}
          >
            <Search size={17} strokeWidth={1.9} color={open ? 'var(--accent-gold)' : 'var(--text-secondary)'} style={{ flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder={t('common.searchEverything')}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              name="gem-global-search"
              tabIndex={open ? 0 : -1}
              style={{ flex: open ? 1 : 0, width: open ? 'auto' : 0, minWidth: 0, padding: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'DM Sans', opacity: open ? 1 : 0, transition: 'opacity 0.2s' }}
            />
            {open && q && (
              <button onMouseDown={e => { e.preventDefault(); setQ(''); inputRef.current?.focus(); }} aria-label={t('common.clear')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2, flexShrink: 0 }}><X size={14} /></button>
            )}
          </div>
          {open && (
            <div style={{ ...card, position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '100%', maxHeight: '62vh', overflowY: 'auto', paddingBottom: 6 }}>
              {resultsList}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Mobile: a tidy icon button that opens a centred overlay. ──
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={t('common.searchEverything')} title={t('common.searchEverything')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <Search size={18} strokeWidth={1.8} />
      </button>

      {open && (
        <div
          onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }}
        >
          <div style={{ ...card, width: 'min(560px, calc(100vw - 32px))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <Search size={17} strokeWidth={1.9} color="var(--accent-gold)" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('common.searchEverything')}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                name="gem-global-search"
                style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 16, fontFamily: 'DM Sans' }}
              />
              <button onClick={() => setOpen(false)} aria-label={t('common.close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ maxHeight: '58vh', overflowY: 'auto', paddingBottom: 6 }}>
              {resultsList}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
