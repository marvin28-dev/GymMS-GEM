import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Search, Eye, Lock, Unlock } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import RowMenu from '../../components/ui/RowMenu';
import LoadFailed from '../../components/ui/LoadFailed';
import { SkeletonCards } from '../../components/Skeleton';
import { getGyms, lockGym, unlockGym } from '../../services/admin.service';
import { PageTitle, Empty, Chips, GymPill, ReasonModal } from './adminUi';
import { card, th, td, money, day, nt, daysSince, lastSeen, refusal } from './adminFormat';

// The server applies these (adminGym.controller FILTERS) and counts each
const FILTER_KEYS = ['all', 'trial', 'paying', 'overdue', 'paused', 'inactive'];
const isInactive = (g) => daysSince(g.createdAt) > 14 && (!g.lastActivity || daysSince(g.lastActivity) > 14);

export default function AdminGyms() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = FILTER_KEYS.includes(params.get('filter')) ? params.get('filter') : 'all';
  // { counts, total, gyms }: at most a screenful, searched on the server
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [locking, setLocking] = useState(null);
  const [problem, setProblem] = useState('');

  const load = useCallback(() => {
    getGyms({ filter, q: q.trim() || undefined }).then(r => { setData(r.data); setFailed(false); }).catch(() => setFailed(true));
  }, [filter, q]);
  // A search waits for a pause in the typing
  useEffect(() => { const timer = setTimeout(load, q ? 250 : 0); return () => clearTimeout(timer); }, [load, q]);
  const gyms = data?.gyms || null;

  const reopen = async (g) => {
    setProblem('');
    try { await unlockGym(g.id); load(); } catch (e) { setProblem(refusal(e, t('admin.saveFailed'))); }
  };

  if (failed && !gyms) return <><PageTitle title={t('admin.navGyms')} /><LoadFailed message={t('admin.loadFailed')} onRetry={load} /></>;
  const list = gyms || [];
  const menu = (g) => [
    { label: t('common.view'), icon: <Eye size={15} />, onClick: () => navigate(`/admin/gyms/${g.id}`) },
    { label: t('admin.pauseAccount'), icon: <Lock size={15} />, onClick: () => setLocking(g), danger: true, hidden: !!g.locked },
    { label: t('admin.reopenAccount'), icon: <Unlock size={15} />, onClick: () => reopen(g), hidden: !g.locked },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageTitle title={t('admin.navGyms')} subtitle={data ? nt(t, 'admin.gymsCount', { n: data.counts.all }) : ''} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '0 1 300px' }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('admin.searchGyms')} aria-label={t('admin.searchGyms')}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 12px 9px 34px', fontSize: isMobile ? 16 : 13.5, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', outline: 'none' }} />
        </div>
        <Chips label={t('admin.filter')} value={filter} onChange={(k) => setParams(k === 'all' ? {} : { filter: k }, { replace: true })}
          items={FILTER_KEYS.map(k => [k, t(`admin.filter_${k}`), data ? data.counts[k] : undefined])} />
      </div>
      {problem && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)' }}>{problem}</div>}
      {data && data.total > list.length && <div data-more-gyms style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>{t('admin.showingFirst', { n: list.length, total: data.total })}</div>}

      {!gyms ? <SkeletonCards count={3} /> : list.length === 0 ? (
        <div style={card}><Empty icon={Building2} title={data.counts.all ? t('admin.noGymsMatch') : t('admin.noGymsYet')} /></div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(g => (
            <div key={g.id} data-gym-row={g.code} style={{ ...card, padding: '12px 14px', display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/admin/gyms/${g.id}`)}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 8px' }}>{g.owner?.name || '-'} · {t('admin.membersShort', { n: g.members.billable })} · {lastSeen(g, t)}</div>
                <GymPill g={g} t={t} />
              </div>
              <RowMenu title={t('common.actions')} items={menu(g)} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{[t('admin.colGym'), t('admin.colOwner'), t('admin.colMembers'), t('admin.colStatus'), t('admin.colLastActive'), t('admin.colEstimate'), ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map(g => (
                <tr key={g.id} data-gym-row={g.code} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/gyms/${g.id}`)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.code}{g.city ? ` · ${g.city}` : ''} · {day(g.createdAt)}</div>
                  </td>
                  <td style={td}>
                    <div>{g.owner?.name || '-'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.owner?.email || ''}</div>
                  </td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{g.members.billable} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/ {g.members.total}</span></td>
                  <td style={td}><GymPill g={g} t={t} /></td>
                  <td style={{ ...td, color: isInactive(g) ? 'var(--accent-yellow)' : 'var(--text-secondary)' }}>{lastSeen(g, t)}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{money(g.monthlyEstimate, g.currency)}</td>
                  <td style={{ ...td, width: 44 }} onClick={e => e.stopPropagation()}><RowMenu title={t('common.actions')} items={menu(g)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {locking && (
        <ReasonModal t={t} danger required title={t('admin.pauseTitle', { gym: locking.name })} hint={t('admin.pauseHint')} label={t('admin.pauseReason')} confirm={t('admin.pauseAccount')}
          onClose={() => setLocking(null)} onSave={async (reason) => { await lockGym(locking.id, reason); load(); }} />
      )}
    </div>
  );
}
