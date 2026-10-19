import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, Dumbbell, Activity, ChevronRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useIsMobile } from '../hooks/useIsMobile';
import useLiveRefresh from '../hooks/useLiveRefresh';
import Avatar from './ui/Avatar';
import EmptyState from './ui/EmptyState';
import MemberStatusTags from './ui/MemberStatusTags';
import TrackPill, { TrackSummary } from './ui/TrackPill';
import { getCoachClients } from '../services/coach.service';
import { trackOf, TRACK_STYLE, reasonLines } from '../utils/coaching';
import { todayStr, dayStr } from '../utils/date';

const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
const ORDER = { off: 0, slipping: 1, nogoal: 2, on: 3, ended: 4 };

// A coach's clients as their manager sees them on the coach's profile: how
// many are on track, how often they come in, what the coach has logged, and
// each client with how they are doing. Opening a client goes to their profile.
export default function CoachClientsPanel({ staffId }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const load = () => getCoachClients(staffId)
    .then(r => { setData(r.data); setError(''); })
    .catch(err => setError(err?.response?.data?.error || t('coach.loadFailed')));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [staffId]);
  useLiveRefresh(load, ['members', 'attendance', 'coach']);

  const today = todayStr();
  const clients = (data?.clients || []).map(c => ({ ...c, track: trackOf(c, today) }))
    .sort((a, b) => ORDER[a.track.key] - ORDER[b.track.key] || `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  const shown = filter === 'all' ? clients : clients.filter(c => c.track.key === filter);
  const count = (k) => clients.filter(c => c.track.key === k).length;

  const card = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14 };
  const lastSeen = (c) => {
    if (!c.lastVisit) return t('coach.neverVisited');
    const d = daysBetween(dayStr(c.lastVisit), today);
    return d <= 0 ? t('coach.seenToday') : d === 1 ? t('coach.seenYesterday') : t('coach.seenDaysAgo', { n: d });
  };
  const tiles = [
    { label: t('coach.tileClients'), value: clients.length, icon: Users, color: 'var(--accent-gold)' },
    { label: t('coach.trackOn'), value: count('on'), icon: Activity, color: 'var(--accent-green)' },
    { label: t('coach.visitsThisMonthTile'), value: clients.reduce((s, c) => s + (c.visitsThisMonth || 0), 0), icon: UserCheck, color: 'var(--accent-blue)' },
    { label: t('coach.tileSessions'), value: data?.sessionsThisMonth ?? 0, icon: Dumbbell, color: 'var(--accent-gold)' },
  ];

  if (error) return <div role="alert" style={{ ...card, padding: 16, fontSize: 13, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{error}</div>;
  if (!data) return <div style={{ ...card, padding: 20, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('common.loading')}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="gem-pay-tiles" style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 4}, minmax(0, 1fr))`, gridAutoRows: '1fr', gap: 10 }}>
        {tiles.map(tile => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} data-coach-tile style={{ ...card, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, fontFamily: 'DM Sans' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}><Icon size={13} color={tile.color} /> {tile.label}</span>
              <span style={{ marginTop: 'auto', fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{tile.value}</span>
            </div>
          );
        })}
      </div>

      <section style={{ ...card, padding: 0 }} aria-label={t('staff.tabClients')}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TrackSummary tracks={clients.map(c => c.track)} />
          {clients.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', 'off', 'slipping', 'nogoal', 'on', 'ended'].filter(k => k === 'all' || count(k)).map(k => (
                <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: filter === k ? 700 : 500, border: `1px solid ${filter === k ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: filter === k ? 'var(--accent-gold-dim)' : 'transparent', color: filter === k ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                  {k === 'all' ? `${t('coach.filterAll')} (${clients.length})` : `${t(TRACK_STYLE[k].labelKey)} (${count(k)})`}
                </button>
              ))}
            </div>
          )}
        </div>
        {clients.length === 0 ? (
          <EmptyState icon={Users} title={t('coach.coachNoClients')} message={t('coach.coachNoClientsHint')} />
        ) : shown.map((c, i) => {
          const diff = c.latestWeight != null && c.firstWeight != null ? Math.round((c.latestWeight - c.firstWeight) * 10) / 10 : null;
          const DiffIcon = diff < 0 ? TrendingDown : diff > 0 ? TrendingUp : Minus;
          return (
            <button key={c.id} data-client-row onClick={() => navigate(`/members/${c.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px', border: 'none', borderTop: i ? '1px solid var(--border-subtle)' : 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans' }}>
              {c.photo
                ? <img src={c.photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <Avatar firstName={c.firstName} lastName={c.lastName} avatarColor={c.avatarColor} size={40} />}
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.firstName} {c.lastName}</span>
                  <TrackPill track={c.track} />
                  {c.track.key !== 'ended' && !['active', 'visitor'].includes(c.status) && <MemberStatusTags member={c} />}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {[c.package?.name, lastSeen(c), t('coach.visitsThisMonth', { n: c.visitsThisMonth }), t('coach.sessionsLoggedN', { n: c.sessionsThisMonth || 0 })].filter(Boolean).join(' · ')}
                </span>
                {reasonLines(c.track, t).length > 0 && (
                  <span style={{ fontSize: 12, color: c.track.key === 'off' ? 'var(--accent-red)' : c.track.key === 'slipping' ? 'var(--accent-yellow)' : 'var(--text-secondary)', fontWeight: 500 }}>{reasonLines(c.track, t).join(' · ')}</span>
                )}
                {c.latestWeight != null && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <b style={{ color: 'var(--text-primary)' }}>{c.latestWeight} kg</b>
                    {diff ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--accent-gold)', fontWeight: 600 }}><DiffIcon size={12} />{diff > 0 ? '+' : ''}{diff} kg</span> : null}
                    {c.latestBodyFat != null && <span>· {c.latestBodyFat}% {t('coach.fatShort')}</span>}
                  </span>
                )}
              </span>
              {!isMobile && <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
            </button>
          );
        })}
      </section>
    </div>
  );
}
