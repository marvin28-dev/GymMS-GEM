import { useState, useEffect, useCallback } from 'react';
import { Dumbbell, Target } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { assignCoach } from '../services/coach.service';
import { getAll as getStaff } from '../services/staff.service';
import { getAuth, getRole } from '../utils/auth';
import { membershipEnded, hasGoals } from '../utils/coaching';
import GoalsModal from './GoalsModal';
import Modal from './ui/Modal';
import LoadFailed from './ui/LoadFailed';

const FITNESS = ['trainer', 'instructor', 'coach'];
const MANAGEMENT = ['general_manager', 'manager'];
const nameOf = (s) => (s ? `${s.firstName || ''} ${s.lastName || ''}`.trim() : '');

// Who coaches this member. A coach can take on a member who has none, setting
// their goals and starting measurements as they do, or let their own client
// go; a manager can give the member to any coach. Everyone else just sees the
// name. Nobody is given a coach once their membership has ended (a coach may
// still let one go).
export default function MemberCoachRow({ member, onChanged }) {
  const { t } = useLanguage();
  const role = getRole();
  const me = getAuth()?.user?.id;
  const isCoach = FITNESS.includes(role);
  const isMgmt = MANAGEMENT.includes(role);
  const [coaches, setCoaches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  const [goalsMode, setGoalsMode] = useState(null);
  // A manager's pick from the list waits here until they confirm it
  const [pending, setPending] = useState(undefined);
  const coach = member?.coach || null;
  const mine = !!coach && coach.id === me;
  const ended = membershipEnded(member);

  // A list that failed to load says so, rather than offering no coaches
  const [coachesFailed, setCoachesFailed] = useState(false);
  const loadCoaches = useCallback(() => {
    getStaff()
      .then(r => { setCoaches((r.data || []).filter(s => FITNESS.includes(s.role) && s.isActive !== false)); setCoachesFailed(false); })
      .catch(() => setCoachesFailed(true));
  }, []);
  useEffect(() => {
    if (isMgmt) loadCoaches();
  }, [isMgmt, loadCoaches]);

  const change = async (coachId) => {
    setBusy(true); setError(''); setConfirmStop(false);
    try {
      const res = await assignCoach(member.id, coachId);
      onChanged?.({ coachId: res.data?.member?.coachId ?? null, coach: res.data?.member?.coach ?? null });
    } catch (err) { setError(err?.response?.data?.error || t('coach.saveFailed')); }
    setBusy(false);
  };

  const btn = (primary) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, fontFamily: 'DM Sans', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
    border: primary ? 'none' : '1px solid var(--border-subtle)', background: primary ? 'linear-gradient(135deg, #c9a96e, #b08d4a)' : 'var(--bg-card)', color: primary ? '#0a0a0f' : 'var(--text-primary)',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', fontFamily: 'DM Sans' }}>
      <Dumbbell size={15} color="var(--accent-gold)" />
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {mine ? t('coach.youCoach') : coach ? <>{t('coach.coachLabel')}: <b style={{ color: 'var(--text-primary)' }}>{nameOf(coach)}</b></> : t('coach.noCoach')}
      </span>
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {isMgmt && (
          <select value={coach?.id || ''} disabled={busy} onChange={e => { const v = e.target.value || null; if (v !== (coach?.id || null)) setPending(v); }} aria-label={t('coach.chooseCoach')}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, color: 'var(--text-primary)', fontFamily: 'DM Sans' }}>
            <option value="">{t('coach.noCoachOption')}</option>
            {/* the current coach is always a choice, even before the list arrives or if they left */}
            {coach && !coaches.some(c => c.id === coach.id) && <option value={coach.id}>{nameOf(coach)}</option>}
            {!ended && coaches.map(c => <option key={c.id} value={c.id}>{nameOf(c)}</option>)}
          </select>
        )}
        {isCoach && !coach && !ended && <button style={btn(true)} disabled={busy} onClick={() => setGoalsMode('takeon')}>{t('coach.takeOn')}</button>}
        {(mine || (isMgmt && coach)) && !ended && !hasGoals(member) && <button style={btn(true)} disabled={busy} onClick={() => setGoalsMode('set')}><Target size={13} /> {t('coach.setGoals')}</button>}
        {ended && (isCoach || isMgmt) && !mine && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('coach.endedCantCoach')}</span>}
        {isCoach && mine && !confirmStop && <button style={btn(false)} disabled={busy} onClick={() => setConfirmStop(true)}>{t('coach.stopCoaching')}</button>}
        {isCoach && mine && confirmStop && (
          <>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{t('coach.stopConfirm')}</span>
            <button style={btn(false)} onClick={() => setConfirmStop(false)}>{t('common.no')}</button>
            <button style={{ ...btn(false), color: 'var(--accent-red)', borderColor: 'rgba(248,113,113,0.4)' }} disabled={busy} onClick={() => change(null)}>{t('common.yes')}</button>
          </>
        )}
      </span>
      {error && <div role="alert" style={{ width: '100%', fontSize: 12.5, color: 'var(--accent-red)' }}>{error}</div>}
      {isMgmt && coachesFailed && <LoadFailed message={t('coach.coachesLoadFailed')} onRetry={loadCoaches} style={{ width: '100%' }} />}
      {isMgmt && (() => {
        const next = pending ? (coaches.find(c => c.id === pending) || (coach?.id === pending ? coach : null)) : null;
        const who = nameOf(member);
        const title = pending === null ? t('coach.confirmRemoveTitle') : coach ? t('coach.confirmMoveTitle') : t('coach.confirmSetTitle');
        const text = pending === null
          ? t('coach.confirmRemove', { coach: nameOf(coach), member: who })
          : coach
            ? t('coach.confirmMove', { member: who, from: nameOf(coach), to: nameOf(next) })
            : t('coach.confirmSet', { coach: nameOf(next), member: who });
        return (
          <Modal open={pending !== undefined} onClose={() => setPending(undefined)} title={title} maxWidth={440}>
            <div data-coach-confirm style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'DM Sans' }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55 }}>{text}</div>
              {pending && member?.email && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('coach.confirmEmailNote', { member: who })}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" style={btn(false)} onClick={() => setPending(undefined)}>{t('common.cancel')}</button>
                <button type="button" disabled={busy}
                  style={pending === null ? { ...btn(false), color: 'var(--accent-red)', borderColor: 'rgba(248,113,113,0.4)' } : btn(true)}
                  onClick={async () => { const v = pending; setPending(undefined); await change(v); }}>
                  {pending === null ? t('coach.confirmRemoveBtn') : t('coach.confirmSetBtn')}
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
      <GoalsModal open={!!goalsMode} mode={goalsMode || 'set'} member={member} onClose={() => setGoalsMode(null)}
        onSaved={(saved) => onChanged?.(goalsMode === 'takeon'
          ? { coachId: saved?.coachId ?? me, coach: saved?.coach ?? { id: me, ...(getAuth()?.user || {}) }, ...pickGoals(saved) }
          : pickGoals(saved))} />
    </div>
  );
}

const GOAL_KEYS = ['goalType', 'goalWeight', 'goalWaist', 'goalBodyFat', 'goalSessionsPerWeek', 'goalTargetDate', 'goalNote', 'goalSetAt'];
const pickGoals = (m) => Object.fromEntries(GOAL_KEYS.filter(k => m && k in m).map(k => [k, m[k]]));
