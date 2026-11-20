import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import GemInput from './ui/GemInput';
import { sendLead } from '../services/billing.service';
import { digitsOnly } from '../utils/number';
import { serverFieldError, fieldErrorStyle, revealFirstError } from '../utils/formErrors';

// The landing page's "Book a free demo": a gym owner leaves their details and
// GEM gets back to them. Each one is a lead on GEM's admin dashboard.
const EMPTY = { name: '', gymName: '', email: '', phone: '', city: '', members: '', message: '', website: '' };

export default function DemoRequestForm({ isMobile }) {
  const { t } = useLanguage();
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => { setF(x => ({ ...x, [k]: k === 'members' ? digitsOnly(e.target.value) : e.target.value })); setErrors(x => ({ ...x, [k]: undefined, _form: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!f.name.trim()) err.name = t('landing.demoNameNeeded');
    if (!f.gymName.trim()) err.gymName = t('landing.demoGymNeeded');
    if (!f.email.trim() && !f.phone.trim()) err.email = t('landing.demoContactNeeded');
    setErrors(err);
    if (Object.keys(err).length) { revealFirstError(); return; }
    setBusy(true);
    try {
      await sendLead({ ...f, members: f.members === '' ? null : Number(f.members) });
      setDone(true);
      setF(EMPTY);
    } catch (error) {
      const se = serverFieldError(error, t('landing.demoFailed'));
      setErrors(se.field ? { [se.field]: se.message } : { _form: se.message });
      revealFirstError();
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div data-demo-sent role="status" style={{ textAlign: 'center', padding: '28px 16px', fontFamily: 'DM Sans, sans-serif' }}>
        <CheckCircle2 size={40} color="var(--accent-green)" style={{ display: 'block', margin: '0 auto 12px' }} />
        <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{t('landing.demoThanks')}</div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 16px', lineHeight: 1.6 }}>{t('landing.demoThanksBody')}</p>
        <button type="button" onClick={() => setDone(false)} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{t('landing.demoAnother')}</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate data-demo-form style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
      <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <GemInput label={t('landing.demoName')} required value={f.name} maxLength={80} onChange={set('name')} error={errors.name} />
        <GemInput label={t('landing.demoGym')} required value={f.gymName} maxLength={120} onChange={set('gymName')} error={errors.gymName} />
        <GemInput label={t('landing.demoEmail')} type="email" value={f.email} maxLength={160} onChange={set('email')} error={errors.email} />
        <GemInput label={t('landing.demoPhone')} inputMode="tel" value={f.phone} maxLength={40} onChange={set('phone')} error={errors.phone} />
        <GemInput label={t('landing.demoCity')} value={f.city} maxLength={80} onChange={set('city')} error={errors.city} />
        <GemInput label={t('landing.demoMembers')} inputMode="numeric" value={f.members} onChange={set('members')} error={errors.members} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor="demo-message" style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'DM Sans, sans-serif' }}>{t('landing.demoMessage')}</label>
        <textarea id="demo-message" value={f.message} onChange={set('message')} rows={3} maxLength={2000} placeholder={t('landing.demoMessagePh')}
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: isMobile ? 16 : 13.5, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', resize: 'vertical', outline: 'none' }} />
        {errors.message && <span role="alert" data-field-error style={fieldErrorStyle}>{errors.message}</span>}
      </div>
      {/* Only a robot fills this in: people never see it */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="demo-website">Website</label>
        <input id="demo-website" tabIndex={-1} value={f.website} onChange={set('website')} />
      </div>
      {errors._form && <div role="alert" data-field-error style={{ ...fieldErrorStyle, fontSize: 13 }}>{errors._form}</div>}
      <button type="submit" data-demo-send disabled={busy}
        style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 10, padding: '13px 22px', fontSize: 14.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? 0.6 : 1, alignSelf: isMobile ? 'stretch' : 'flex-start' }}>
        <Send size={15} /> {busy ? t('landing.demoSending') : t('landing.demoSend')}
      </button>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>{t('landing.demoPrivacy')}</span>
    </form>
  );
}
