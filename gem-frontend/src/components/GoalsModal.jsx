import { useState, useEffect } from 'react';
import { Target, Ruler } from 'lucide-react';
import Modal from './ui/Modal';
import GemInput from './ui/GemInput';
import { useLanguage } from '../contexts/LanguageContext';
import { assignCoach, setGoals } from '../services/coach.service';
import { getAuth } from '../utils/auth';
import { GOAL_TYPES } from '../utils/coaching';
import { todayStr, addDaysStr, fmtDate } from '../utils/date';
import { serverFieldError, fieldErrorStyle, revealFirstError } from '../utils/formErrors';

const decimal = (v) => String(v).replace(',', '.').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 7);
const MEASURES = [['weight', 'coach.weightKg', '84.5'], ['waist', 'coach.waistCm', '92'], ['bodyFat', 'coach.bodyFatPct', '24'], ['hips', 'coach.hipsCm', '100'], ['chest', 'coach.chestCm', '98']];

// What a member is working towards, and where they start from. A coach taking
// someone on fills it in as part of taking them ("takeon"); a client a manager
// assigned gets it the first time the coach opens it ("set"); afterwards the
// goals can be changed and new measurements are optional ("edit"). Figures
// take any number above zero; every problem is shown under its own field.
export default function GoalsModal({ open, onClose, member, mode = 'set', onSaved }) {
  const { t } = useLanguage();
  const requireBaseline = mode !== 'edit';
  const [now, setNow] = useState({});
  const [goal, setGoal] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNow({});
    setGoal(mode === 'edit' && member ? {
      goalType: member.goalType || '', goalWeight: member.goalWeight ?? '', goalWaist: member.goalWaist ?? '', goalBodyFat: member.goalBodyFat ?? '',
      goalSessionsPerWeek: member.goalSessionsPerWeek || '', goalTargetDate: member.goalTargetDate ? String(member.goalTargetDate).slice(0, 10) : '', goalNote: member.goalNote || '',
    } : { goalType: '', goalWeight: '', goalWaist: '', goalBodyFat: '', goalSessionsPerWeek: '', goalTargetDate: '', goalNote: '' });
    setErrors({}); setSaving(false);
  }, [open, mode, member]);

  const name = member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() : '';
  const clear = (k) => setErrors(e => ({ ...e, [k]: undefined, _form: undefined }));
  const setN = (k) => (e) => { setNow(n => ({ ...n, [k]: decimal(e.target.value) })); clear(`baseline.${k}`); };
  const setG = (k, v) => { setGoal(g => ({ ...g, [k]: v })); clear(k); };

  // A one-line summary of what was typed, so the coach can read the plan back
  const diff = (a, b) => (a !== '' && b !== '' && a != null && b != null ? Math.round((Number(b) - Number(a)) * 10) / 10 : null);
  const wDiff = diff(now.weight, goal.goalWeight), cDiff = diff(now.waist, goal.goalWaist);
  const summary = [
    goal.goalType && t(`coach.goal_${goal.goalType}`),
    wDiff ? t(wDiff < 0 ? 'coach.sumLose' : 'coach.sumGain', { n: Math.abs(wDiff) }) : null,
    cDiff ? t(cDiff < 0 ? 'coach.sumWaistDown' : 'coach.sumWaistUp', { n: Math.abs(cDiff) }) : null,
    goal.goalSessionsPerWeek ? t('coach.sumPerWeek', { n: goal.goalSessionsPerWeek }) : null,
    goal.goalTargetDate ? t('coach.sumBy', { date: fmtDate(goal.goalTargetDate, { day: 'numeric', month: 'short', year: 'numeric' }) }) : null,
  ].filter(Boolean).join(' · ');

  const save = async () => {
    if (saving) return;
    const req = t('common.required');
    const above = t('coach.mustBePositive');
    const e = {};
    for (const [k] of MEASURES) {
      if (now[k] !== undefined && now[k] !== '' && !(Number(now[k]) > 0)) e[`baseline.${k}`] = above;
    }
    if (requireBaseline && !now.weight) e['baseline.weight'] = req;
    if (requireBaseline && !now.waist) e['baseline.waist'] = req;
    if (!goal.goalType) e.goalType = t('coach.needGoalType');
    if (!(Number(goal.goalWeight) > 0)) e.goalWeight = goal.goalWeight === '' ? req : above;
    if (!(Number(goal.goalWaist) > 0)) e.goalWaist = goal.goalWaist === '' ? req : above;
    if (goal.goalBodyFat !== '' && goal.goalBodyFat != null && !(Number(goal.goalBodyFat) > 0)) e.goalBodyFat = above;
    if (!goal.goalSessionsPerWeek) e.goalSessionsPerWeek = t('coach.needPerWeek');
    setErrors(e);
    if (Object.keys(e).length) { revealFirstError(); return; }
    const baseline = Object.fromEntries(Object.entries(now).filter(([, v]) => v !== ''));
    const goals = { ...goal, goalSessionsPerWeek: Number(goal.goalSessionsPerWeek) };
    setSaving(true);
    try {
      const res = mode === 'takeon'
        ? await assignCoach(member.id, getAuth()?.user?.id, { goals, baseline })
        : await setGoals(member.id, goals, Object.keys(baseline).length ? baseline : undefined);
      onSaved?.(mode === 'takeon' ? res.data?.member : res.data);
      onClose?.();
    } catch (err) {
      const se = serverFieldError(err, t('coach.saveFailed'));
      setErrors(se.field ? { [se.field]: se.message } : { _form: se.message });
      setSaving(false);
    }
  };

  const err = (k) => errors[k] && <span role="alert" style={fieldErrorStyle}>{errors[k]}</span>;
  const sectionHead = (Icon, text, hint) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontFamily: 'DM Sans' }}><Icon size={13} /> {text}</span>
      {hint && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{hint}</span>}
    </div>
  );
  const chip = (on, bad) => ({ padding: '7px 12px', borderRadius: 20, fontSize: 12.5, fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: on ? 700 : 500, border: `1px solid ${on ? 'var(--accent-gold)' : bad ? 'var(--accent-red)' : 'var(--border-subtle)'}`, background: on ? 'var(--accent-gold-dim)' : 'var(--bg-card)', color: on ? 'var(--accent-gold)' : 'var(--text-secondary)' });

  return (
    <Modal open={open} onClose={onClose} title={mode === 'takeon' ? t('coach.takeOnTitle', { name }) : mode === 'edit' ? t('coach.editGoalsTitle', { name }) : t('coach.setGoalsTitle', { name })} maxWidth={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mode === 'takeon' && <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans', lineHeight: 1.5 }}>{t('coach.takeOnIntro')}</div>}

        {sectionHead(Ruler, requireBaseline ? t('coach.startHead') : t('coach.newMeasuresHead'), requireBaseline ? t('coach.startHint') : t('coach.newMeasuresHint'))}
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {MEASURES.map(([k, label, ph]) => (
            <GemInput key={k} label={t(label)} required={requireBaseline && (k === 'weight' || k === 'waist')} type="text" inputMode="decimal" data-decimal
              value={now[k] || ''} onChange={setN(k)} placeholder={ph} error={errors[`baseline.${k}`]} />
          ))}
        </div>

        {sectionHead(Target, t('coach.goalHead'), t('coach.goalHint'))}
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, marginBottom: 8 }}>{t('coach.goalTypeLabel')} *</div>
          <div role="radiogroup" aria-label={t('coach.goalTypeLabel')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GOAL_TYPES.map(k => (
              <button key={k} type="button" role="radio" aria-checked={goal.goalType === k} onClick={() => setG('goalType', k)} style={chip(goal.goalType === k, errors.goalType)}>{t(`coach.goal_${k}`)}</button>
            ))}
          </div>
          {err('goalType')}
        </div>
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <GemInput label={t('coach.goalWeightKg')} required error={errors.goalWeight} type="text" inputMode="decimal" data-decimal value={goal.goalWeight ?? ''} onChange={e => setG('goalWeight', decimal(e.target.value))} placeholder="75" />
          <GemInput label={t('coach.goalWaistCm')} required error={errors.goalWaist} type="text" inputMode="decimal" data-decimal value={goal.goalWaist ?? ''} onChange={e => setG('goalWaist', decimal(e.target.value))} placeholder="82" />
          <GemInput label={t('coach.goalBodyFatPct')} error={errors.goalBodyFat} type="text" inputMode="decimal" data-decimal value={goal.goalBodyFat ?? ''} onChange={e => setG('goalBodyFat', decimal(e.target.value))} placeholder="18" />
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500, marginBottom: 8 }}>{t('coach.perWeekLabel')} *</div>
          <div role="radiogroup" aria-label={t('coach.perWeekLabel')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 7].map(n => (
              <button key={n} type="button" role="radio" aria-checked={Number(goal.goalSessionsPerWeek) === n} onClick={() => setG('goalSessionsPerWeek', n)}
                style={{ ...chip(Number(goal.goalSessionsPerWeek) === n, errors.goalSessionsPerWeek), width: 40, padding: '7px 0', textAlign: 'center' }}>{n}</button>
            ))}
          </div>
          {err('goalSessionsPerWeek')}
        </div>
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <GemInput label={t('coach.targetDate')} type="date" error={errors.goalTargetDate} min={addDaysStr(todayStr(), 1)} value={goal.goalTargetDate || ''} onChange={e => setG('goalTargetDate', e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500 }}>{t('coach.goalNoteLabel')}</label>
          <textarea value={goal.goalNote || ''} onChange={e => setG('goalNote', e.target.value)} rows={2} maxLength={500} placeholder={t('coach.goalNotePh')}
            style={{ background: 'var(--bg-elevated)', border: `1px solid ${errors.goalNote ? 'var(--accent-red)' : 'var(--border-subtle)'}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
          {err('goalNote')}
        </div>

        {summary && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--accent-gold-glow)', border: '1px solid var(--accent-gold-dim)', fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
            <Target size={14} color="var(--accent-gold)" style={{ flexShrink: 0, marginTop: 1 }} /> <span>{summary}</span>
          </div>
        )}
        {errors._form && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{errors._form}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={onClose} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 8, fontSize: 13, fontWeight: 600, padding: '9px 16px', cursor: 'pointer', fontFamily: 'DM Sans' }}>{t('common.cancel')}</button>
          <button type="button" onClick={save} disabled={saving}
            style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, padding: '9px 18px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'DM Sans' }}>
            {saving ? t('common.saving') : mode === 'takeon' ? t('coach.startCoaching') : t('coach.saveGoals')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
