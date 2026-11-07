import { useState, useEffect, useCallback, useId } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, MessageSquareWarning, Lightbulb, HelpCircle, Send, CheckCircle, Inbox, ArrowLeft, Clock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { getAuth } from '../utils/auth';
import { fmtDate, fmtTime } from '../utils/date';
import { serverFieldError, fieldErrorStyle, revealFirstError } from '../utils/formErrors';
import { getMine, send } from '../services/support.service';
import GemInput from '../components/ui/GemInput';
import PageHeader from '../components/ui/PageHeader';
import LoadFailed from '../components/ui/LoadFailed';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/Skeleton';
import SupportLinks from '../components/SupportLinks';
import AppFooter from '../components/AppFooter';

// Where anyone signed in tells GEM something is wrong, makes a complaint, or
// asks a question (the owner, 7 November 2026). The report is kept on the
// server and emailed to GEM support; WhatsApp and email are here too, for
// whoever would rather talk. Opened from the sidebar (More on a phone), the
// account menu and the desk's header; /front-desk/support keeps the desk.
const KINDS = [
  { id: 'problem', icon: AlertTriangle, labelKey: 'support.kindProblem' },
  { id: 'complaint', icon: MessageSquareWarning, labelKey: 'support.kindComplaint' },
  { id: 'suggestion', icon: Lightbulb, labelKey: 'support.kindSuggestion' },
  { id: 'question', icon: HelpCircle, labelKey: 'support.kindQuestion' },
];
const KIND_LABEL = Object.fromEntries(KINDS.map(k => [k.id, k.labelKey]));
const MAX_SUBJECT = 120;
const MAX_MESSAGE = 4000;

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14 };
const sectionTitle = { fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 };
const blank = { kind: '', subject: '', message: '' };

export default function SupportPage() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const atDesk = location.pathname.startsWith('/front-desk');
  const user = getAuth()?.user || {};
  const kindLabelId = useId();
  const messageId = useId();

  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  // null while writing; { emailed } once sent
  const [outcome, setOutcome] = useState(null);
  const [sendFailed, setSendFailed] = useState('');

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyFailed, setHistoryFailed] = useState(false);

  const loadHistory = useCallback(() => {
    setHistoryFailed(false);
    getMine()
      .then(res => setHistory(Array.isArray(res.data) ? res.data : []))
      .catch(() => setHistoryFailed(true))
      .finally(() => setHistoryLoading(false));
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
    setSendFailed('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!form.kind) found.kind = t('support.kindRequired');
    if (!form.subject.trim()) found.subject = t('support.subjectRequired');
    if (!form.message.trim()) found.message = t('support.messageRequired');
    setErrors(found);
    setSendFailed('');
    if (Object.keys(found).length) { revealFirstError(); return; }
    setSending(true);
    try {
      const res = await send({ ...form, subject: form.subject.trim(), message: form.message.trim(), page: location.state?.from || '' });
      setOutcome({ emailed: !!res.data?.emailed });
      if (res.data?.report) setHistory(list => [res.data.report, ...list.filter(r => r.id !== res.data.report.id)]);
      setForm(blank);
    } catch (err) {
      const { field, message } = serverFieldError(err, t('support.failed'));
      if (field) setErrors({ [field]: message });
      else setSendFailed(message);
    } finally {
      setSending(false);
    }
  };

  const hint = form.kind === 'problem' || !form.kind ? t('support.hintProblem') : t('support.hintOther');

  const reportForm = outcome ? (
    <div data-support-outcome={outcome.emailed ? 'sent' : 'not-sent'} role="status" style={{ padding: isMobile ? '22px 18px' : '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
      {outcome.emailed
        ? <CheckCircle size={40} color="var(--accent-green)" />
        : <AlertTriangle size={40} color="var(--accent-yellow)" />}
      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
        {outcome.emailed ? t('support.sentTitle') : t('support.notSentTitle')}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 420 }}>
        {outcome.emailed
          ? (user.email ? t('support.sentBody', { email: user.email }) : t('support.sentBodyNoEmail'))
          : t('support.notSentBody')}
      </p>
      {!outcome.emailed && <SupportLinks style={{ marginTop: 4 }} />}
      <button type="button" onClick={() => setOutcome(null)} style={{ marginTop: 8, background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
        {t('support.sendAnother')}
      </button>
    </div>
  ) : (
    <form onSubmit={submit} noValidate data-support-form style={{ padding: isMobile ? 16 : 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div id={kindLabelId} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'DM Sans', fontWeight: 500 }}>{t('support.kindLabel')} *</div>
        <div role="group" aria-labelledby={kindLabelId} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {KINDS.map(({ id, icon: Icon, labelKey }) => {
            const on = form.kind === id;
            return (
              <button key={id} type="button" data-support-kind={id} aria-pressed={on} onClick={() => set('kind', id)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, textAlign: 'left',
                padding: '12px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12.5, fontWeight: 600, lineHeight: 1.3,
                background: on ? 'var(--accent-gold-dim)' : 'var(--bg-elevated)',
                border: `1px solid ${on ? 'var(--accent-gold)' : errors.kind ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
                color: on ? 'var(--accent-gold)' : 'var(--text-primary)',
                transition: 'background 0.15s, border-color 0.15s',
              }}>
                <Icon size={16} strokeWidth={1.8} />
                {t(labelKey)}
              </button>
            );
          })}
        </div>
        {errors.kind && <span role="alert" data-field-error style={fieldErrorStyle}>{errors.kind}</span>}
      </div>

      <GemInput
        label={t('support.subjectLabel')} required name="subject" value={form.subject} maxLength={MAX_SUBJECT}
        placeholder={t('support.subjectPlaceholder')} onChange={e => set('subject', e.target.value)} error={errors.subject}
      />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label htmlFor={messageId} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontFamily: 'DM Sans', fontWeight: 500 }}>{t('support.messageLabel')} *</label>
        <textarea
          id={messageId} name="message" value={form.message} maxLength={MAX_MESSAGE} rows={isMobile ? 6 : 7}
          placeholder={hint} onChange={e => set('message', e.target.value)}
          aria-invalid={errors.message ? true : undefined}
          style={{
            width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 130,
            background: 'var(--bg-elevated)', border: `1px solid ${errors.message ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
            borderRadius: 10, padding: '10px 14px', fontSize: 13, lineHeight: 1.55, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', outline: 'none',
          }}
        />
        {errors.message && <span role="alert" data-field-error style={fieldErrorStyle}>{errors.message}</span>}
      </div>

      {sendFailed && (
        <div role="alert" data-support-failed style={{ background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: 'var(--accent-red)', lineHeight: 1.5 }}>
          {sendFailed}
          <SupportLinks quiet tint label={t('common.supportLine')} style={{ marginTop: 4 }} />
        </div>
      )}

      <button type="submit" disabled={sending} style={{
        alignSelf: isMobile ? 'stretch' : 'flex-start', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: 'var(--on-accent-gold)', border: 'none', borderRadius: 10,
        padding: '11px 22px', fontSize: 13.5, fontWeight: 700, cursor: sending ? 'default' : 'pointer', fontFamily: 'DM Sans', opacity: sending ? 0.7 : 1,
      }}>
        <Send size={14} /> {sending ? t('support.sending') : t('support.send')}
      </button>
    </form>
  );

  const direct = (
    <section style={{ ...card, padding: isMobile ? 16 : 20 }} aria-labelledby="support-direct">
      <h2 id="support-direct" style={sectionTitle}>{t('support.direct')}</h2>
      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: '6px 0 0' }}>{t('support.directBody')}</p>
      <SupportLinks start style={{ marginTop: 12 }} />
      {user.gymCode && <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: '12px 0 0' }}>{t('support.gymCodeHint', { code: user.gymCode })}</p>}
    </section>
  );

  const historyCard = (
    <section style={card} aria-labelledby="support-history" data-support-history>
      <h2 id="support-history" style={{ ...sectionTitle, padding: isMobile ? '16px 16px 0' : '18px 20px 0' }}>{t('support.history')}</h2>
      <div style={{ padding: isMobile ? '10px 16px 16px' : '12px 20px 18px' }}>
        {historyFailed ? (
          <LoadFailed message={t('support.historyLoadFailed')} onRetry={loadHistory} />
        ) : historyLoading ? (
          <SkeletonList rows={2} />
        ) : history.length === 0 ? (
          <EmptyState icon={Inbox} title={t('support.noReports')} message={t('support.noReportsHint')} />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {history.map((r, i) => (
              <li key={r.id} data-support-report style={{ padding: '12px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 0, overflowWrap: 'anywhere' }}>{r.subject}</span>
                  <span data-support-status={r.emailedAt ? 'sent' : 'not-sent'} style={{
                    marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                    background: r.emailedAt ? 'var(--accent-green-dim)' : 'var(--accent-yellow-dim)',
                    color: r.emailedAt ? 'var(--accent-green)' : 'var(--accent-yellow)',
                  }}>{r.emailedAt ? t('support.statusSent') : t('support.statusNotSent')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)' }}>
                  <span>{t(KIND_LABEL[r.kind] || 'support.kindQuestion')}</span>
                  <span aria-hidden="true">·</span>
                  <Clock size={11} />
                  <span>{fmtDate(r.createdAt)} {fmtTime(r.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );

  const page = (
    <div data-support-page style={{ maxWidth: 1080, margin: atDesk ? '0 auto' : undefined }}>
      {atDesk && (
        <button type="button" onClick={() => navigate('/front-desk')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 14, fontFamily: 'DM Sans' }}>
          <ArrowLeft size={14} /> {t('staff.backToFrontDesk')}
        </button>
      )}
      <PageHeader title={t('support.title')} subtitle={t('support.subtitle')} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: isMobile ? 14 : 20, alignItems: 'start' }}>
        <section style={card} aria-labelledby="support-report">
          <h2 id="support-report" style={{ ...sectionTitle, padding: isMobile ? '16px 16px 0' : '20px 22px 0' }}>{t('support.reportTitle')}</h2>
          {reportForm}
        </section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 20 }}>
          {direct}
          {historyCard}
        </div>
      </div>
    </div>
  );

  // Inside the app the layout gives the page its padding and footer; the desk
  // has no frame of its own
  if (!atDesk) return <div style={{ padding: isMobile ? 16 : 0 }}>{page}</div>;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: isMobile ? 16 : 28 }}>{page}</div>
      <AppFooter style={{ padding: isMobile ? '20px 16px 24px' : '6px 16px 12px' }} />
    </div>
  );
}
