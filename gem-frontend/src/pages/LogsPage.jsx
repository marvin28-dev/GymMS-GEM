import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck, KeyRound, Users2, Users, CreditCard, Banknote, Clock, Settings,
  Search, RotateCw, X, ChevronDown, ChevronUp, AlertTriangle, History, Bot,
} from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLanguage } from '../contexts/LanguageContext';
import { getLogs } from '../services/logs.service';

const CATEGORIES = [
  { key: 'authorization', labelKey: 'logs.catAuthorization', icon: ShieldCheck, color: 'var(--accent-gold)', dim: 'var(--accent-gold-dim)' },
  { key: 'security', labelKey: 'logs.catSecurity', icon: KeyRound, color: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)' },
  { key: 'staff', labelKey: 'logs.catStaff', icon: Users2, color: 'var(--accent-purple)', dim: 'var(--accent-purple-dim)' },
  { key: 'members', labelKey: 'logs.catMembers', icon: Users, color: 'var(--accent-green)', dim: 'var(--accent-green-dim)' },
  { key: 'money', labelKey: 'logs.catMoney', icon: CreditCard, color: 'var(--accent-yellow)', dim: 'var(--accent-yellow-dim)' },
  { key: 'payroll', labelKey: 'logs.catPayroll', icon: Banknote, color: 'var(--accent-yellow)', dim: 'var(--accent-yellow-dim)' },
  { key: 'timecards', labelKey: 'logs.catTimecards', icon: Clock, color: 'var(--accent-blue)', dim: 'var(--accent-blue-dim)' },
  { key: 'settings', labelKey: 'logs.catSettings', icon: Settings, color: 'var(--text-secondary)', dim: 'var(--bg-elevated)' },
];
const CATEGORY = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

// Attempts that were refused, and pay the system held back. These are the
// entries the owner most needs to notice, so they are marked in red.
const WARNINGS = new Set([
  'auth.code_refused', 'auth.password_refused', 'auth.login_failed',
  'frontdesk.code_refused', 'frontdesk.code_locked', 'pay.held',
]);

const ROLE_KEYS = {
  general_manager: 'generalManager', manager: 'manager', trainer: 'trainer',
  instructor: 'instructor', front_desk: 'frontDesk', coach: 'coach',
};

const humanize = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()).replace(/ ([A-Z])/g, (_, c) => ` ${c.toLowerCase()}`);
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function Details({ details, t }) {
  const changes = Array.isArray(details?.changes) ? details.changes : [];
  const rest = Object.entries(details || {}).filter(([k, v]) => k !== 'changes' && v !== null && v !== undefined && v !== '');
  const row = { display: 'flex', flexWrap: 'wrap', gap: '2px 10px', padding: '6px 0', borderTop: '1px solid var(--border-subtle)', fontSize: 12.5, lineHeight: 1.45 };
  const label = { color: 'var(--text-muted)', minWidth: 120, flexShrink: 0 };
  const value = { color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word', minWidth: 0 };
  return (
    <div style={{ marginTop: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '4px 12px' }}>
      {changes.map((c, i) => (
        <div key={`c${i}`} style={{ ...row, borderTop: i === 0 ? 'none' : row.borderTop }}>
          <span style={label}>{c.field}</span>
          {c.from === undefined && c.to === undefined ? (
            <span style={{ ...value, fontFamily: 'DM Sans', color: 'var(--text-secondary)' }}>{t('logs.changedHidden')}</span>
          ) : (
            <span style={value}>
              {c.from !== undefined && <><span style={{ color: 'var(--text-secondary)' }}>{c.from}</span>{' → '}</>}
              {c.to}
            </span>
          )}
        </div>
      ))}
      {rest.map(([k, v], i) => (
        <div key={k} style={{ ...row, borderTop: i === 0 && changes.length === 0 ? 'none' : row.borderTop }}>
          <span style={label}>{humanize(k)}</span>
          <span style={value}>{Array.isArray(v) ? v.join(' · ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
        </div>
      ))}
    </div>
  );
}

function Entry({ entry, open, onToggle, locale, isMobile, t, last }) {
  const cat = CATEGORY[entry.category] || CATEGORY.settings;
  const warn = WARNINGS.has(entry.action);
  const Icon = warn ? AlertTriangle : entry.actorId || entry.actorName ? cat.icon : Bot;
  const time = new Date(entry.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const who = entry.actorName || (entry.actorId ? t('logs.unknown') : entry.action === 'auth.login_failed' ? t('logs.unknown') : t('logs.system'));
  const role = entry.actorRole && ROLE_KEYS[entry.actorRole] ? t(`staff.${ROLE_KEYS[entry.actorRole]}`) : null;
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;

  const chip = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: warn ? 'var(--accent-red)' : cat.color, background: warn ? 'var(--accent-red-dim)' : cat.dim, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap', fontFamily: 'DM Sans' }}>
      {warn ? t('logs.failed') : t(cat.labelKey)}
    </span>
  );

  return (
    <div style={{ display: 'flex', gap: 12, padding: isMobile ? '12px 14px' : '14px 18px', borderBottom: last ? 'none' : '1px solid var(--border-subtle)' }}>
      {!isMobile && (
        <div style={{ width: 70, flexShrink: 0, paddingTop: 7, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{time}</div>
      )}
      <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: warn ? 'var(--accent-red-dim)' : cat.dim }}>
        <Icon size={15} color={warn ? 'var(--accent-red)' : cat.color} strokeWidth={1.9} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
            {chip}
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{time}</span>
          </div>
        )}
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text-primary)', fontFamily: 'DM Sans', wordBreak: 'break-word' }}>{entry.summary}</div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', marginTop: 4, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
          <span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{who}</span>
            {role && <span>{` · ${role}`}</span>}
          </span>
          {hasDetails && (
            <button type="button" onClick={onToggle} aria-expanded={open}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent-gold)', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans' }}>
              {open ? t('logs.hideDetails') : t('logs.details')}
              {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
        {open && hasDetails && <Details details={entry.details} t={t} />}
      </div>
      {!isMobile && <div style={{ flexShrink: 0, paddingTop: 5 }}>{chip}</div>}
    </div>
  );
}

// The Log section of Settings: one card, like the other sections, with its
// filters at the top and the entries grouped under each day.
export default function ActivityLog() {
  const isMobile = useIsMobile();
  const { t, lang } = useLanguage();
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';

  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [retentionDays, setRetentionDays] = useState(30);
  const [openIds, setOpenIds] = useState(() => new Set());

  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // A slow answer to an older filter must not overwrite a newer one
  const requestId = useRef(0);
  const load = useCallback(async ({ append = false, after = null } = {}) => {
    const mine = ++requestId.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const res = await getLogs({
        ...(category ? { category } : {}),
        ...(query ? { q: query } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(after ? { cursor: after } : {}),
        limit: 50,
      });
      if (mine !== requestId.current) return;
      setItems(prev => (append ? [...prev, ...res.data.items] : res.data.items));
      setCursor(res.data.nextCursor);
      if (res.data.retentionDays) setRetentionDays(res.data.retentionDays);
    } catch (err) {
      if (mine !== requestId.current) return;
      setError(err?.response?.data?.error || t('logs.loadError'));
    } finally {
      if (mine === requestId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [category, query, from, to, t]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setOpenIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const filtered = !!(category || query || from || to);
  const clearFilters = () => { setCategory(''); setSearch(''); setQuery(''); setFrom(''); setTo(''); };

  // Entries arrive newest first; group them under their day
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const groups = [];
  for (const entry of items) {
    const d = new Date(entry.createdAt);
    const key = dayKey(d);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const date = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const label = key === dayKey(today) ? `${t('logs.today')} · ${date}` : key === dayKey(yesterday) ? `${t('logs.yesterday')} · ${date}` : date;
      group = { key, label, entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }

  const edge = isMobile ? 16 : 20;
  const line = '1px solid var(--border-subtle)';
  const control = { background: 'var(--bg-elevated)', border: line, borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box' };
  const dateField = ([label, value, set]) => (
    <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans', textTransform: 'uppercase', letterSpacing: 1.2, minWidth: 0 }}>
      {label}
      <input type="date" value={value} onChange={e => set(e.target.value)} style={{ ...control, width: '100%', padding: '8px 10px', textTransform: 'none', letterSpacing: 0 }} />
    </label>
  );
  const note = (text) => (
    <div style={{ padding: `32px ${edge}px`, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>{text}</div>
  );

  return (
    <div style={{ background: 'var(--bg-card)', border: line, borderRadius: 14, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
      {/* Title bar, as on every other Settings section */}
      <div style={{ padding: `${isMobile ? 14 : 18}px ${edge}px`, borderBottom: line, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>{t('logs.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5, fontFamily: 'DM Sans', maxWidth: 560 }}>{t('logs.subtitle')}</div>
        </div>
        <button type="button" onClick={() => load()} disabled={loading} aria-label={t('logs.refresh')} title={t('logs.refresh')}
          style={{ ...control, display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? 8 : '7px 12px', cursor: loading ? 'default' : 'pointer', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
          <RotateCw size={13} />
          {!isMobile && t('logs.refresh')}
        </button>
      </div>

      {/* Filters */}
      <div style={{ padding: `14px ${edge}px`, borderBottom: line, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 0 }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('logs.search')} aria-label={t('logs.search')}
              style={{ ...control, width: '100%', padding: '9px 34px 9px 36px' }} />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label={t('common.close')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: isMobile ? '1 1 100%' : '0 1 300px' }}>
            {[[t('logs.from'), from, setFrom], [t('logs.to'), to, setTo]].map(dateField)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', margin: isMobile ? `0 -${edge}px` : 0, padding: isMobile ? `0 ${edge}px 2px` : 0, scrollbarWidth: 'none' }}>
          {[{ key: '', labelKey: 'logs.all' }, ...CATEGORIES].map(c => {
            const active = category === c.key;
            return (
              <button key={c.key || 'all'} type="button" onClick={() => setCategory(c.key)} aria-pressed={active}
                style={{ flexShrink: 0, padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans', cursor: 'pointer', whiteSpace: 'nowrap', border: `1px solid ${active ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: active ? 'var(--accent-gold-dim)' : 'transparent', color: active ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                {t(c.labelKey)}
              </button>
            );
          })}
          {filtered && (
            <button type="button" onClick={clearFilters}
              style={{ flexShrink: 0, marginLeft: 'auto', background: 'none', border: 'none', padding: '5px 2px', cursor: 'pointer', color: 'var(--accent-gold)', fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans', whiteSpace: 'nowrap' }}>
              {t('logs.clearFilters')}
            </button>
          )}
        </div>
      </div>

      {/* Entries */}
      {error && (
        <div role="alert" style={{ margin: `14px ${edge}px`, fontSize: 13, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid var(--accent-red)', borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans' }}>{error}</div>
      )}
      {loading && items.length === 0 && !error && note(t('logs.loading'))}
      {!loading && !error && items.length === 0 && note(filtered ? t('logs.emptyFiltered') : t('logs.empty'))}

      {groups.map(g => (
        <div key={g.key}>
          <div style={{ padding: `8px ${edge}px`, background: 'var(--bg-elevated)', borderBottom: line, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
            {g.label}
          </div>
          {g.entries.map((entry, i) => (
            <Entry key={entry.id} entry={entry} open={openIds.has(entry.id)} onToggle={() => toggle(entry.id)}
              locale={locale} isMobile={isMobile} t={t} last={i === g.entries.length - 1} />
          ))}
        </div>
      ))}

      {/* Footer: how long entries are kept, and older pages */}
      <div style={{ padding: `12px ${edge}px`, borderTop: items.length ? line : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>
          <History size={13} /> {t('logs.retention', { days: retentionDays })}
        </span>
        {cursor && (
          <button type="button" onClick={() => load({ append: true, after: cursor })} disabled={loadingMore}
            style={{ ...control, padding: '7px 14px', cursor: loadingMore ? 'default' : 'pointer', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
            {loadingMore ? t('logs.loading') : t('logs.loadMore')}
          </button>
        )}
      </div>
    </div>
  );
}
