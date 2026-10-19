import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserCheck, Dumbbell, BellRing, CalendarDays, Clock, MapPin, Search,
  Phone, MessageCircle, Plus, ChevronRight, Cake, CalendarX, ClipboardList, TrendingDown, TrendingUp, Minus, Target, Ruler, StickyNote,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useIsMobile } from '../hooks/useIsMobile';
import useLiveRefresh from '../hooks/useLiveRefresh';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import MemberStatusTags from '../components/ui/MemberStatusTags';
import VisitKindBadge from '../components/ui/VisitKindBadge';
import { SkeletonCards } from '../components/Skeleton';
import LogProgressModal from '../components/LogProgressModal';
import TrackPill, { TrackSummary } from '../components/ui/TrackPill';
import GoalsModal from '../components/GoalsModal';
import RowMenu from '../components/ui/RowMenu';
import { getOverview } from '../services/coach.service';
import { followUpsOf, trackOf, membershipEnded, hasGoals, reasonLines } from '../utils/coaching';
import { getAuth } from '../utils/auth';
import { gymCache } from '../utils/gymCache';
import { todayStr, dayStr, fmtDate, fmtTime, capFirst, getDateLocale } from '../utils/date';
import { hasPhone, whatsappLink, callLink } from '../utils/contact';

// What a coach sees when they sign in. Built for the gym floor and a phone:
// who they have today, whose weekly check-in is due, who they train and
// whether each is on track for their goals, and one tap to log a session or
// message a client on WhatsApp. Money never appears here.

const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14 };
const sectionTitle = { display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' };
const iconBtn = (bg, color) => ({ width: 34, height: 34, borderRadius: 9, border: 'none', background: bg, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, textDecoration: 'none' });

export default function CoachDashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const user = getAuth()?.user || {};
  const cache = gymCache('coach');
  const [data, setData] = useState(() => cache.read('overview', null));
  const [loading, setLoading] = useState(() => !cache.has('overview'));
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [logFor, setLogFor] = useState(null);
  const [showAllIn, setShowAllIn] = useState(false);
  const [logKind, setLogKind] = useState('session');
  const [goalsFor, setGoalsFor] = useState(null);

  const load = () => getOverview()
    .then(r => { setData(r.data); cache.write('overview', r.data); setError(''); })
    .catch(err => setError(err?.response?.data?.error || t('coach.loadFailed')))
    .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  useLiveRefresh(load, ['members', 'attendance', 'coach', 'calendar', 'tasks', 'timecards']);

  const today = todayStr();
  const clients = data?.clients || [];
  const inToday = new Set((data?.checkinsToday || []).filter(c => c.mine).map(c => c.member.id));
  const withFollow = clients.map(c => ({ ...c, follow: followUpsOf(c, today), track: trackOf(c, today) }));
  // Goals to set first, then this week's check-ins, then everything else
  const RANK = { goals: 0, checkin: 1, ending: 2, away: 3, birthday: 4 };
  const followUps = withFollow.filter(c => c.follow.length)
    .sort((a, b) => RANK[a.follow[0].type] - RANK[b.follow[0].type]);
  const checkinsDue = withFollow.filter(c => c.follow.some(f => f.type === 'checkin' || f.type === 'goals')).length;
  const coachName = data?.coach?.firstName || user.firstName || '';
  const gymName = user.gymName || 'GEM';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('coach.goodMorning') : hour < 18 ? t('coach.goodAfternoon') : t('coach.goodEvening');
  const dateLine = capFirst(new Date().toLocaleDateString(getDateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }));

  const lastSeen = (c) => {
    if (!c.lastVisit) return t('coach.neverVisited');
    const d = daysBetween(dayStr(c.lastVisit), today);
    return d <= 0 ? t('coach.seenToday') : d === 1 ? t('coach.seenYesterday') : t('coach.seenDaysAgo', { n: d });
  };
  const reasonText = (f) => (f.type === 'goals' ? t('coach.reasonGoals')
    : f.type === 'checkin' ? (f.days == null ? t('coach.reasonFirstCheckin') : t('coach.reasonCheckinDue', { n: f.days }))
    : f.type === 'away' ? (f.days == null ? t('coach.reasonNeverCame') : t('coach.reasonAway', { n: f.days }))
    : f.type === 'ending' ? (f.days === 0 ? t('coach.reasonEndsToday') : t('coach.reasonEnds', { date: fmtDate(f.date, { day: 'numeric', month: 'short' }) }))
    : f.days === 0 ? t('coach.reasonBirthdayToday') : t('coach.reasonBirthday', { day: capFirst(new Date(`${f.date}T00:00:00`).toLocaleDateString(getDateLocale(), { weekday: 'long' })) }));
  const message = (c, f) => {
    const vars = { name: c.firstName, coach: coachName, gym: gymName, date: f?.date ? fmtDate(f.date, { day: 'numeric', month: 'long' }) : '' };
    if (f?.type === 'ending') return t('coach.msgEnding', vars);
    if (f?.type === 'birthday') return t('coach.msgBirthday', vars);
    if (f?.type === 'away') return t('coach.msgAway', vars);
    if (f?.type === 'checkin' || f?.type === 'goals') return t('coach.msgCheckin', vars);
    return t('coach.msgHello', vars);
  };

  const q = search.trim().toLowerCase();
  const shownClients = withFollow
    .filter(c => (filter === 'follow' ? c.follow.length : filter === 'in' ? inToday.has(c.id) : true))
    .filter(c => !q || `${c.firstName} ${c.lastName} ${c.memberCode || ''} ${c.phone || ''}`.toLowerCase().includes(q));

  const tiles = [
    { label: t('coach.tileClients'), value: clients.length, sub: t('coach.tileClientsSub', { n: clients.filter(c => ['active', 'expiring', 'visitor'].includes(c.status)).length }), icon: Users, color: 'var(--accent-gold)', onClick: () => setFilter('all') },
    { label: t('coach.tileInToday'), value: inToday.size, sub: t('coach.tileInTodaySub', { n: (data?.checkinsToday || []).length }), icon: UserCheck, color: 'var(--accent-green)', onClick: () => setFilter('in') },
    { label: t('coach.tileSessions'), value: data?.sessionsThisMonth ?? 0, sub: t('coach.tileSessionsSub'), icon: Dumbbell, color: 'var(--accent-blue)' },
    { label: t('coach.tileFollowUp'), value: checkinsDue, sub: t('coach.tileFollowUpSub'), icon: BellRing, color: checkinsDue ? 'var(--accent-yellow)' : 'var(--text-muted)', onClick: () => setFilter('follow') },
  ];

  const WeightChange = ({ c }) => {
    if (c.latestWeight == null) return null;
    const diff = c.firstWeight != null ? Math.round((c.latestWeight - c.firstWeight) * 10) / 10 : 0;
    const Icon = diff < 0 ? TrendingDown : diff > 0 ? TrendingUp : Minus;
    return (
      <span title={t('coach.sinceFirst')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        <b style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{c.latestWeight} kg</b>
        {diff !== 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--accent-gold)', fontWeight: 600 }}><Icon size={12} />{diff > 0 ? '+' : ''}{diff} kg</span>}
      </span>
    );
  };

  const openLog = (c, kind = 'session') => { setLogKind(kind); setLogFor(c); };
  // The one thing to do for a client: set their goals, take the check-in, or log
  const PrimaryAction = ({ c, f }) => {
    if (membershipEnded(c)) return null;
    const goals = !hasGoals(c);
    const checkin = !goals && f?.type === 'checkin';
    const Icon = goals ? Target : checkin ? Ruler : Plus;
    // Otherwise "Log" opens the three separate popups: a session, measurements or a note
    if (!goals && !checkin) {
      return (
        <RowMenu title={t('coach.log')}
          buttonContent={<><Plus size={13} /> {t('coach.log')}</>}
          buttonStyle={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 9, border: '1px solid var(--accent-gold)', background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', flexShrink: 0, whiteSpace: 'nowrap' }}
          items={[
            { label: t('coach.logSession'), icon: <Dumbbell size={15} />, onClick: () => openLog(c, 'session') },
            { label: t('coach.logMeasure'), icon: <Ruler size={15} />, onClick: () => openLog(c, 'measure') },
            { label: t('coach.logNote'), icon: <StickyNote size={15} />, onClick: () => openLog(c, 'note') },
          ]} />
      );
    }
    return (
      <button onClick={() => (goals ? setGoalsFor(c) : openLog(c, checkin ? 'measure' : 'session'))}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 9, border: '1px solid var(--accent-gold)', background: goals || checkin ? 'linear-gradient(135deg, #c9a96e, #b08d4a)' : 'var(--accent-gold-dim)', color: goals || checkin ? '#0a0a0f' : 'var(--accent-gold)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', flexShrink: 0, whiteSpace: 'nowrap' }}>
        <Icon size={13} /> {goals ? t('coach.setGoals') : checkin ? t('coach.recordCheckin') : t('coach.log')}
      </button>
    );
  };

  const ContactButtons = ({ c, f }) => hasPhone(c.phone) ? (
    <>
      <a href={whatsappLink(c.phone, message(c, f))} target="_blank" rel="noopener noreferrer" aria-label={t('coach.whatsapp')} title={t('coach.whatsapp')} style={iconBtn('rgba(37,211,102,0.14)', '#25d366')}><MessageCircle size={16} /></a>
      <a href={callLink(c.phone)} aria-label={t('coach.call')} title={t('coach.call')} style={iconBtn('var(--accent-blue-dim)', 'var(--accent-blue)')}><Phone size={15} /></a>
    </>
  ) : null;

  const Photo = ({ m, size = 40 }) => (m.photo
    ? <img src={m.photo} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <Avatar firstName={m.firstName} lastName={m.lastName} avatarColor={m.avatarColor} size={size} />);

  // ── Sections ──
  const scheduleSection = (
    <section style={{ ...card, padding: 0 }} aria-labelledby="coach-today">
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 id="coach-today" style={{ ...sectionTitle, margin: 0 }}><CalendarDays size={16} color="var(--accent-gold)" /> {t('coach.todaySchedule')}</h2>
        <button onClick={() => navigate('/calendar')} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 2 }}>{t('coach.openCalendar')} <ChevronRight size={14} /></button>
      </div>
      {(data?.schedule || []).length === 0 ? (
        <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('coach.nothingToday')}</div>
      ) : data.schedule.map((e, i) => (
        <div key={e.id} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--border-subtle)' : 'none', alignItems: 'flex-start' }}>
          <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: e.color || 'var(--accent-gold)', flexShrink: 0 }} />
          <div style={{ minWidth: 56, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', paddingTop: 1 }}>{e.time || t('coach.anyTime')}</div>
          <div style={{ flex: 1, minWidth: 0, fontFamily: 'DM Sans' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{e.title}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {e.duration && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{e.duration}</span>}
              {e.location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />{e.location}</span>}
              {e.spots != null && <span>{t('coach.spots', { n: e.spots })}</span>}
              {e.isPrivate && <span>{t('coach.myDiary')}</span>}
              {e.leading && <span style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>{t('coach.youLead')}</span>}
              {e.response === 'todo' && <span style={{ color: 'var(--accent-yellow)', fontWeight: 600 }}>{t('coach.notAnswered')}</span>}
            </div>
          </div>
        </div>
      ))}
    </section>
  );

  const followSection = (
    <section style={{ ...card, padding: 0 }} aria-labelledby="coach-follow">
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 id="coach-follow" style={{ ...sectionTitle, margin: 0 }}><BellRing size={16} color="var(--accent-yellow)" /> {t('coach.followUp')}</h2>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 3 }}>{t('coach.followUpHint')}</div>
      </div>
      {followUps.length === 0 ? (
        <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{clients.length ? t('coach.allGood') : t('coach.followUpEmpty')}</div>
      ) : followUps.slice(0, 8).map((c, i) => {
        const f = c.follow[0];
        const ReasonIcon = f.type === 'birthday' ? Cake : f.type === 'ending' ? CalendarX : f.type === 'goals' ? Target : f.type === 'checkin' ? Ruler : Clock;
        return (
          <div key={c.id} data-follow-row style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderTop: i ? '1px solid var(--border-subtle)' : 'none', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <button onClick={() => navigate(`/members/${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
              <Photo m={c} size={36} />
              <span style={{ minWidth: 0, fontFamily: 'DM Sans' }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.firstName} {c.lastName}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: f.type === 'birthday' ? 'var(--accent-gold)' : f.type === 'goals' ? 'var(--accent-blue)' : 'var(--accent-yellow)', fontWeight: 600 }}><ReasonIcon size={12} /> {reasonText(f)}</span>
                {c.follow.length > 1 && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>{c.follow.slice(1).map(reasonText).join(' · ')}</span>}
              </span>
            </button>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: isMobile ? 46 : 0 }}>
              <PrimaryAction c={c} f={f} />
              <ContactButtons c={c} f={f} />
            </span>
          </div>
        );
      })}
    </section>
  );

  const clientsSection = (
    <section style={{ ...card, padding: 0 }} aria-labelledby="coach-clients">
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h2 id="coach-clients" style={{ ...sectionTitle, margin: 0 }}><Users size={16} color="var(--accent-gold)" /> {t('coach.myClients')} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{clients.length}</span></h2>
          <button onClick={() => navigate('/members')} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={13} /> {t('coach.addClient')}</button>
        </div>
        {clients.length > 0 && (
          <>
            <TrackSummary tracks={withFollow.map(c => c.track)} />
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('coach.searchClients')} aria-label={t('coach.searchClients')}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 12px 9px 32px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['all', t('coach.filterAll')], ['follow', t('coach.filterFollow', { n: followUps.length })], ['in', t('coach.filterIn', { n: inToday.size })]].map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: filter === k ? 700 : 500, border: `1px solid ${filter === k ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: filter === k ? 'var(--accent-gold-dim)' : 'transparent', color: filter === k ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>{label}</button>
              ))}
            </div>
          </>
        )}
      </div>
      {clients.length === 0 ? (
        <div style={{ padding: 8 }}>
          <EmptyState icon={Users} title={t('coach.noClientsTitle')} message={t('coach.noClientsHint')} />
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 16 }}>
            <button onClick={() => navigate('/members')} style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, padding: '9px 16px', cursor: 'pointer', fontFamily: 'DM Sans' }}>{t('coach.browseMembers')}</button>
          </div>
        </div>
      ) : shownClients.length === 0 ? (
        <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('coach.noMatch')}</div>
      ) : shownClients.map((c, i) => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: i ? '1px solid var(--border-subtle)' : 'none', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <button onClick={() => navigate(`/members/${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: isMobile ? 'calc(100% - 4px)' : 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ position: 'relative', flexShrink: 0 }}>
              <Photo m={c} size={42} />
              {inToday.has(c.id) && <span title={t('coach.inNow')} style={{ position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-green)', border: '2px solid var(--bg-card)' }} />}
            </span>
            <span style={{ minWidth: 0, flex: 1, fontFamily: 'DM Sans', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{c.firstName} {c.lastName}</span>
                <TrackPill track={c.track} />
                {c.track.key !== 'ended' && !['active', 'visitor'].includes(c.status) && <MemberStatusTags member={c} />}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {[c.package?.name, lastSeen(c), t('coach.visitsThisMonth', { n: c.visitsThisMonth })].filter(Boolean).join(' · ')}
              </span>
              {reasonLines(c.track, t).length > 0 && c.track.key !== 'on' && (
                <span style={{ fontSize: 12, color: c.track.key === 'off' ? 'var(--accent-red)' : 'var(--accent-yellow)', fontWeight: 500 }}>{reasonLines(c.track, t).join(' · ')}</span>
              )}
              <WeightChange c={c} />
            </span>
          </button>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: isMobile ? 53 : 0 }}>
            <PrimaryAction c={c} f={null} />
            <ContactButtons c={c} f={c.follow[0]} />
          </div>
        </div>
      ))}
    </section>
  );

  const checkins = data?.checkinsToday || [];
  const inGymSection = (
    <section style={{ ...card, padding: 0 }} aria-labelledby="coach-in">
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <h2 id="coach-in" style={{ ...sectionTitle, margin: 0 }}><UserCheck size={16} color="var(--accent-green)" /> {t('coach.inGymToday')} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{checkins.length}</span></h2>
      </div>
      {checkins.length === 0 ? (
        <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('coach.noCheckins')}</div>
      ) : (showAllIn ? checkins : checkins.slice(0, 6)).map((v, i) => (
        <button key={v.id} onClick={() => navigate(`/members/${v.member.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', borderTop: i ? '1px solid var(--border-subtle)' : 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans' }}>
          <Photo m={v.member} size={32} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.member.firstName} {v.member.lastName}</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              {v.mine && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--accent-gold)', background: 'var(--accent-gold-dim)', borderRadius: 20, padding: '1px 8px' }}>{t('coach.yourClient')}</span>}
              <VisitKindBadge kind={v.kind} isVisitor={v.member.isVisitor} onlyPasses />
            </span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtTime(v.at)}</span>
        </button>
      ))}
      {checkins.length > 6 && (
        <button onClick={() => setShowAllIn(s => !s)} style={{ width: '100%', padding: '10px', border: 'none', borderTop: '1px solid var(--border-subtle)', background: 'none', color: 'var(--accent-gold)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
          {showAllIn ? t('coach.showLess') : t('coach.showAll', { n: checkins.length })}
        </button>
      )}
    </section>
  );

  return (
    <div className="page-fade" style={{ padding: isMobile ? '16px 16px 96px' : '24px 28px', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {/* Greeting and shift */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'Manrope, sans-serif', fontSize: isMobile ? 21 : 24, fontWeight: 800, color: 'var(--text-primary)' }}>{greeting}, {coachName}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: 3 }}>{dateLine}</div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 20, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', fontSize: 12.5, fontFamily: 'DM Sans', color: 'var(--text-secondary)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: data?.shift && !data.shift.until ? 'var(--accent-green)' : 'var(--text-muted)' }} />
          {data?.shift ? (data.shift.until ? t('coach.shiftDone', { from: fmtTime(data.shift.since), to: fmtTime(data.shift.until) }) : t('coach.onShift', { time: fmtTime(data.shift.since) })) : t('coach.notClockedIn')}
        </div>
      </div>

      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--accent-red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans' }}>{error}</div>}

      {/* Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {tiles.map(tile => {
          const Icon = tile.icon;
          return (
            <button key={tile.label} onClick={tile.onClick} disabled={!tile.onClick}
              style={{ ...card, padding: '13px 14px', textAlign: 'left', cursor: tile.onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, fontFamily: 'DM Sans' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}><Icon size={13} color={tile.color} /> {tile.label}</span>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{loading ? '…' : tile.value}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{tile.sub}</span>
            </button>
          );
        })}
      </div>

      {data?.openTasks > 0 && (
        <button onClick={() => navigate('/my-profile?tab=tasks')} style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans', color: 'var(--text-secondary)', fontSize: 13 }}>
          <ClipboardList size={16} color="var(--accent-blue)" />
          <span style={{ flex: 1 }}>{t('coach.openTasks', { n: data.openTasks })}</span>
          <ChevronRight size={15} />
        </button>
      )}

      {loading && !data ? <SkeletonCards count={3} height={120} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.25fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {scheduleSection}
            {followSection}
            {!isMobile && inGymSection}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {clientsSection}
            {isMobile && inGymSection}
          </div>
        </div>
      )}

      <LogProgressModal
        open={!!logFor}
        initialKind={logKind}
        member={logFor}
        last={logFor && logFor.lastCheckIn ? { weight: logFor.latestWeight, waist: logFor.latestWaist, bodyFat: logFor.latestBodyFat, date: logFor.lastCheckIn } : null}
        onClose={() => setLogFor(null)}
        onSaved={() => load()}
      />
      <GoalsModal open={!!goalsFor} mode="set" member={goalsFor} onClose={() => setGoalsFor(null)} onSaved={() => load()} />
    </div>
  );
}
