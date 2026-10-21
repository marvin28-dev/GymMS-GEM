import { useState, useEffect } from 'react';
import { Dumbbell, Ruler, StickyNote } from 'lucide-react';
import Modal from './ui/Modal';
import GemInput from './ui/GemInput';
import { useLanguage } from '../contexts/LanguageContext';
import { addProgress } from '../services/coach.service';
import { todayStr, fmtDate } from '../utils/date';
import { serverFieldError, fieldErrorStyle, revealFirstError } from '../utils/formErrors';

// What a coach writes down about a member, as three separate popups, each
// asking only for what it is about:
//   a session    - how long, what was worked (or something of their own), how hard
//   measurements - the figures (the weekly check-in), with the last ones shown
//   a note       - what it is about, and the note itself
// Built for the gym floor on a phone: mostly taps, little typing.
const decimal = (v) => String(v).replace(',', '.').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 7);
const SESSION_FOCUS = ['full_body', 'upper', 'lower', 'core', 'cardio', 'strength', 'mobility', 'technique'];
const EFFORTS = ['easy', 'moderate', 'hard'];
const NOTE_CATEGORIES = ['general', 'injury', 'nutrition', 'motivation'];
const DURATIONS = [30, 45, 60, 90];
const MEASURES = [['weight', 'coach.weightKg', 'kg'], ['bodyFat', 'coach.bodyFatPct', '%'], ['waist', 'coach.waistCm', 'cm'], ['hips', 'coach.hipsCm', 'cm'], ['chest', 'coach.chestCm', 'cm']];

// Each popup's own look: its colour, icon, heading and what it is for
const KIND_LOOK = {
  session: { icon: Dumbbell,   color: 'var(--accent-gold)',   dim: 'var(--accent-gold-dim)',   titleKey: 'coach.sessionTitle', hintKey: 'coach.sessionHint', saveKey: 'coach.saveSession' },
  measure: { icon: Ruler,      color: 'var(--accent-blue)',   dim: 'var(--accent-blue-dim)',   titleKey: 'coach.measureTitle', hintKey: 'coach.measureHint', saveKey: 'coach.saveMeasures' },
  note:    { icon: StickyNote, color: 'var(--accent-purple)', dim: 'var(--accent-purple-dim)', titleKey: 'coach.noteTitle',    hintKey: 'coach.noteHint',    saveKey: 'coach.saveNote' },
};

export default function LogProgressModal({ open, onClose, member, initialKind = 'session', last = null, lastWeight = null, onSaved }) {
  const { t } = useLanguage();
  const kind = initialKind;
  const look = KIND_LOOK[kind] || KIND_LOOK.session;
  const [date, setDate] = useState(todayStr());
  const [duration, setDuration] = useState('');
  const [focus, setFocus] = useState([]);
  const [otherFocus, setOtherFocus] = useState('');
  const [effort, setEffort] = useState('');
  const [figures, setFigures] = useState({});
  const [category, setCategory] = useState('general');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setDate(todayStr()); setDuration(''); setFocus([]); setOtherFocus(''); setEffort(''); setFigures({}); setCategory('general'); setNote(''); setErrors({}); setSaving(false);
  }, [open, initialKind]);

  const lastValues = last || (lastWeight?.value != null ? { weight: lastWeight.value, date: lastWeight.date } : null);
  const clear = (k) => setErrors(e => ({ ...e, [k]: undefined, _form: undefined }));
  const otherOn = focus.includes('other');

  const save = async () => {
    if (saving) return;
    const req = t('common.required');
    const body = { kind, date: date === todayStr() ? new Date().toISOString() : date };
    const e = {};
    if (kind === 'session') {
      if (!duration || !(Number(duration) > 0)) e.durationMin = t('coach.needDuration');
      const chosen = [...focus.filter(f => f !== 'other'), ...(otherOn && otherFocus.trim() ? [otherFocus.trim()] : [])];
      if (otherOn && !otherFocus.trim()) e.focusOther = t('coach.needOtherFocus');
      else if (!chosen.length) e.focus = t('coach.needFocus');
      if (!effort) e.effort = t('coach.needEffort');
      Object.assign(body, { durationMin: Number(duration), focus: chosen, effort, note: note.trim() || null });
    } else if (kind === 'measure') {
      const values = Object.fromEntries(Object.entries(figures).filter(([, v]) => v !== ''));
      for (const [k, v] of Object.entries(values)) if (!(Number(v) > 0)) e[k] = t('coach.mustBePositive');
      if (!Object.keys(values).length) e._measures = t('coach.needOneMeasure');
      Object.assign(body, values);
    } else {
      if (!note.trim()) e.note = req;
      Object.assign(body, { category, note: note.trim() });
    }
    setErrors(e);
    if (Object.keys(e).length) { revealFirstError(); return; }
    setSaving(true);
    try {
      const res = await addProgress(member.id, body);
      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      const se = serverFieldError(err, t('coach.saveFailed'));
      setErrors(se.field ? { [se.field]: se.message } : { _form: se.message });
      setSaving(false);
    }
  };

  const label = { fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans', fontWeight: 500 };
  const chip = (on, bad) => ({ padding: '7px 12px', borderRadius: 20, fontSize: 12.5, fontFamily: 'DM Sans', cursor: 'pointer', fontWeight: on ? 700 : 500, border: `1px solid ${on ? look.color : bad ? 'var(--accent-red)' : 'var(--border-subtle)'}`, background: on ? look.dim : 'var(--bg-card)', color: on ? look.color : 'var(--text-secondary)' });
  const err = (k) => errors[k] && <span role="alert" style={fieldErrorStyle}>{errors[k]}</span>;
  const textarea = (value, onChange, rows, ph, bad) => (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} maxLength={1000} placeholder={ph}
      style={{ background: 'var(--bg-elevated)', border: `1px solid ${bad ? 'var(--accent-red)' : 'var(--border-subtle)'}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
  );

  const name = member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() : '';
  const Icon = look.icon;
  return (
    <Modal open={open} onClose={onClose} title={t(look.titleKey, { name })} maxWidth={500}>
      <div data-log-kind={kind} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: look.dim, border: `1px solid ${look.dim}` }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={18} color={look.color} /></span>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans', lineHeight: 1.45 }}>{t(look.hintKey)}</span>
        </div>

        <div>
          <GemInput label={t('coach.date')} type="date" value={date} max={todayStr()} error={errors.date} onChange={e => { if (e.target.value && e.target.value <= todayStr()) { setDate(e.target.value); clear('date'); } }} />
        </div>

        {kind === 'session' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={label}>{t('coach.durationLabel')} *</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {DURATIONS.map(m => (
                  <button key={m} type="button" aria-pressed={Number(duration) === m} onClick={() => { setDuration(String(m)); clear('durationMin'); }} style={chip(Number(duration) === m, errors.durationMin)}>{t('coach.minutesN', { n: m })}</button>
                ))}
                <input aria-label={t('coach.durationLabel')} type="text" inputMode="numeric" value={DURATIONS.includes(Number(duration)) ? '' : duration} placeholder={t('coach.otherMinutes')}
                  onChange={e => { setDuration(e.target.value.replace(/\D/g, '').slice(0, 4)); clear('durationMin'); }}
                  style={{ width: 92, background: 'var(--bg-elevated)', border: `1px solid ${errors.durationMin ? 'var(--accent-red)' : 'var(--border-subtle)'}`, borderRadius: 20, padding: '7px 12px', fontSize: 12.5, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' }} />
              </div>
              {err('durationMin')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={label}>{t('coach.focusLabel')} *</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[...SESSION_FOCUS, 'other'].map(f => {
                  const on = focus.includes(f);
                  return <button key={f} type="button" aria-pressed={on} onClick={() => { setFocus(prev => (on ? prev.filter(x => x !== f) : [...prev, f])); clear('focus'); clear('focusOther'); }} style={chip(on, errors.focus)}>{t(`coach.focus_${f}`)}</button>;
                })}
              </div>
              {otherOn && (
                <div>
                  <input data-focus-other autoFocus value={otherFocus} maxLength={60} placeholder={t('coach.otherFocusPh')} aria-label={t('coach.otherFocusLabel')}
                    onChange={e => { setOtherFocus(e.target.value.replace(/,/g, ' ')); clear('focusOther'); }}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-elevated)', border: `1px solid ${errors.focusOther ? 'var(--accent-red)' : 'var(--border-subtle)'}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' }} />
                  {err('focusOther')}
                </div>
              )}
              {err('focus')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={label}>{t('coach.effortLabel')} *</span>
              <div role="radiogroup" aria-label={t('coach.effortLabel')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {EFFORTS.map(x => <button key={x} type="button" role="radio" aria-checked={effort === x} onClick={() => { setEffort(x); clear('effort'); }} style={{ ...chip(effort === x, errors.effort), textAlign: 'center' }}>{t(`coach.effort_${x}`)}</button>)}
              </div>
              {err('effort')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={label}>{t('coach.howItWent')}</span>
              {textarea(note, (v) => { setNote(v); clear('note'); }, 2, t('coach.sessionPh'), errors.note)}
              {err('note')}
            </div>
          </>
        )}

        {kind === 'measure' && (
          <>
            <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {MEASURES.map(([k, key]) => (
                <GemInput key={k} label={t(key)} type="text" inputMode="decimal" data-decimal value={figures[k] || ''} error={errors[k]}
                  onChange={e => { setFigures(f => ({ ...f, [k]: decimal(e.target.value) })); clear(k); clear('_measures'); }}
                  placeholder={lastValues?.[k] != null ? String(lastValues[k]) : ''} />
              ))}
            </div>
            {err('_measures')}
            {lastValues && MEASURES.some(([k]) => lastValues[k] != null) && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', marginTop: -4 }}>
                {t('coach.lastCheckin', { date: fmtDate(lastValues.date) })}: {MEASURES.filter(([k]) => lastValues[k] != null).map(([k, , unit]) => `${lastValues[k]} ${unit} ${t(`coach.short_${k}`)}`.trim()).join(' · ')}
              </div>
            )}
          </>
        )}

        {kind === 'note' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={label}>{t('coach.noteAbout')}</span>
              <div role="radiogroup" aria-label={t('coach.noteAbout')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {NOTE_CATEGORIES.map(c => <button key={c} type="button" role="radio" aria-checked={category === c} onClick={() => { setCategory(c); clear('category'); }} style={chip(category === c, errors.category)}>{t(`coach.noteCat_${c}`)}</button>)}
              </div>
              {err('category')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={label}>{t('coach.noteLabel')} *</span>
              {textarea(note, (v) => { setNote(v); clear('note'); }, 4, t(`coach.notePh_${category}`), errors.note)}
              {err('note')}
            </div>
          </>
        )}

        {errors._form && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{errors._form}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" onClick={onClose} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 8, fontSize: 13, fontWeight: 600, padding: '9px 16px', cursor: 'pointer', fontFamily: 'DM Sans' }}>{t('common.cancel')}</button>
          <button type="button" onClick={save} disabled={saving}
            style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, padding: '9px 18px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'DM Sans' }}>
            {saving ? t('common.saving') : t(look.saveKey)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
