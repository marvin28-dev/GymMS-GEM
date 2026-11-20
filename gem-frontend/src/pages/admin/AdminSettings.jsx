import { useCallback, useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import GemInput from '../../components/ui/GemInput';
import LoadFailed from '../../components/ui/LoadFailed';
import { SkeletonCards } from '../../components/Skeleton';
import { getSettings, saveSettings } from '../../services/admin.service';
import { digitsOnly } from '../../utils/number';
import { PageTitle, Problem } from './adminUi';
import { card, goldBtn, sectionLabel, field, money, refusal } from './adminFormat';

// GEM's own settings: the price per member, when a bill falls due, the free
// trial, and how gyms pay GEM
export default function AdminSettings() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [s, setS] = useState(null);
  const [f, setF] = useState(null);
  const [failed, setFailed] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    getSettings().then(r => {
      setS(r.data);
      setF({ pricePerMember: String(r.data.pricePerMember), currency: r.data.currency, dueDays: String(r.data.dueDays), trialDays: String(r.data.trialDays), paymentInstructions: r.data.paymentInstructions || '' });
      setFailed(false);
    }).catch(() => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (failed && !s) return <><PageTitle title={t('admin.navSettings')} /><LoadFailed message={t('admin.loadFailed')} onRetry={load} /></>;
  if (!s || !f) return <><PageTitle title={t('admin.navSettings')} /><SkeletonCards count={2} /></>;

  const set = (k, digits) => (e) => { setF(x => ({ ...x, [k]: digits ? digitsOnly(e.target.value) : e.target.value })); setErrors(x => ({ ...x, [k]: undefined, _form: undefined })); setSaved(false); };
  const save = async () => {
    setBusy(true); setSaved(false);
    try {
      await saveSettings({ ...f, pricePerMember: f.pricePerMember === '' ? '' : Number(f.pricePerMember), dueDays: f.dueDays === '' ? '' : Number(f.dueDays), trialDays: f.trialDays === '' ? '' : Number(f.trialDays) });
      setSaved(true); load();
    } catch (err) {
      const field = err?.response?.data?.field;
      setErrors(field ? { [field]: refusal(err, t('admin.saveFailed')) } : { _form: refusal(err, t('admin.saveFailed')) });
    }
    setBusy(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
      <PageTitle title={t('admin.navSettings')} subtitle={t('admin.settingsSub')} />
      <section style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }} aria-labelledby="admin-pricing" data-admin-settings>
        <div id="admin-pricing" style={sectionLabel}>{t('admin.pricing')}</div>
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <GemInput label={t('admin.pricePerMember')} inputMode="numeric" value={f.pricePerMember} onChange={set('pricePerMember', true)} error={errors.pricePerMember} />
          <GemInput label={t('admin.currency')} maxLength={3} value={f.currency} onChange={e => set('currency')({ target: { value: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') } })} error={errors.currency} />
          <GemInput label={t('admin.dueDays')} inputMode="numeric" value={f.dueDays} onChange={set('dueDays', true)} error={errors.dueDays} />
          <GemInput label={t('admin.trialDays')} inputMode="numeric" value={f.trialDays} onChange={set('trialDays', true)} error={errors.trialDays} />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>
          {t('admin.pricingExample', { price: money(Number(f.pricePerMember) || 0, f.currency || 'XAF'), total: money((Number(f.pricePerMember) || 0) * 100, f.currency || 'XAF') })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="pay-instructions" style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'DM Sans, sans-serif' }}>{t('admin.paymentInstructions')}</label>
          <textarea id="pay-instructions" value={f.paymentInstructions} onChange={set('paymentInstructions')} rows={4} maxLength={1000} placeholder={t('admin.paymentInstructionsPh')} style={{ ...field, resize: 'vertical', borderColor: errors.paymentInstructions ? 'var(--accent-red)' : 'var(--border-subtle)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>{t('admin.paymentInstructionsHint')}</span>
          {errors.paymentInstructions && <span role="alert" data-field-error style={{ fontSize: 12, color: 'var(--accent-red)' }}>{errors.paymentInstructions}</span>}
        </div>
        <Problem>{errors._form}</Problem>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" data-save-settings style={{ ...goldBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={save}><Save size={15} /> {t('common.save')}</button>
          {saved && <span role="status" style={{ fontSize: 13, color: 'var(--accent-green)', fontFamily: 'DM Sans, sans-serif' }}>{t('admin.saved')}</span>}
        </div>
      </section>

      <section style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'DM Sans, sans-serif' }} aria-labelledby="admin-account">
        <div id="admin-account" style={sectionLabel}>{t('admin.account')}</div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t('admin.signedInAs', { email: s.adminEmail })}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('admin.accountHint')}</div>
        {s.email.testMode && (
          <div data-email-test-mode style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)', background: 'var(--accent-yellow-dim)', borderRadius: 10, padding: '10px 12px', marginTop: 4 }}>
            <Info size={15} color="var(--accent-yellow)" style={{ flexShrink: 0, marginTop: 1 }} />{t('admin.emailTestMode')}
          </div>
        )}
      </section>
    </div>
  );
}
