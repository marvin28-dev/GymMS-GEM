import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LifeBuoy, Mail, Phone, Send } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import Modal from '../../components/ui/Modal';
import GemSelect from '../../components/ui/GemSelect';
import LoadFailed from '../../components/ui/LoadFailed';
import { SkeletonCards } from '../../components/Skeleton';
import { getReports, updateReport, replyToReport } from '../../services/admin.service';
import { PageTitle, Empty, Chips, Pill, Problem } from './adminUi';
import { card, goldBtn, plainBtn, sectionLabel, field, day, refusal } from './adminFormat';

const STATUS_TONE = { new: 'amber', in_progress: 'blue', resolved: 'green' };
const KINDS = ['problem', 'complaint', 'suggestion', 'question'];
const KIND_TONE = { problem: 'red', complaint: 'amber', suggestion: 'purple', question: 'blue' };

// Every problem, complaint, idea and question sent from a gym's Help & support page
export default function AdminProblems() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const [reports, setReports] = useState(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('open');
  const [kind, setKind] = useState('all');

  const load = useCallback(() => { getReports().then(r => { setReports(r.data); setFailed(false); }).catch(() => setFailed(true)); }, []);
  useEffect(() => { load(); }, [load]);

  const openId = params.get('open');
  const opened = reports?.find(r => r.id === openId) || null;
  const open = (id) => setParams(id ? { open: id } : {}, { replace: true });

  const STATUS = { open: (r) => r.status !== 'resolved', new: (r) => r.status === 'new', in_progress: (r) => r.status === 'in_progress', resolved: (r) => r.status === 'resolved', all: () => true };
  const byStatus = (reports || []).filter(STATUS[status]);
  const list = byStatus.filter(r => kind === 'all' || r.kind === kind);

  if (failed && !reports) return <><PageTitle title={t('admin.navProblems')} /><LoadFailed message={t('admin.loadFailed')} onRetry={load} /></>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageTitle title={t('admin.navProblems')} subtitle={t('admin.problemsSub')} />
      <Chips label={t('admin.filter')} value={status} onChange={setStatus} items={Object.keys(STATUS).map(k => [k, t(`admin.report_${k}`), reports ? reports.filter(STATUS[k]).length : undefined])} />
      <Chips label={t('admin.kind')} value={kind} onChange={setKind} items={[['all', t('admin.allKinds')], ...KINDS.map(k => [k, t(`support.kind${k[0].toUpperCase()}${k.slice(1)}`), reports ? byStatus.filter(r => r.kind === k).length : undefined])]} />

      {!reports ? <SkeletonCards count={3} /> : list.length === 0 ? (
        <div style={card}><Empty icon={LifeBuoy} title={t('admin.noReports')} hint={status === 'open' ? t('admin.noReportsHint') : ''} /></div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          {list.map((r, i) => (
            <button key={r.id} type="button" data-report={r.status} onClick={() => open(r.id)}
              style={{ width: '100%', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 6 : 12, padding: '13px 16px', background: 'none', border: 'none', borderTop: i ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>{r.subject}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.gym?.name || '-'} · {r.senderName} · {day(r.createdAt)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <Pill tone={KIND_TONE[r.kind]}>{t(`support.kind${r.kind[0].toUpperCase()}${r.kind.slice(1)}`)}</Pill>
                <Pill tone={STATUS_TONE[r.status]}>{t(`admin.report_${r.status}`)}</Pill>
              </div>
            </button>
          ))}
        </div>
      )}
      {opened && <ReportModal key={opened.id} r={opened} t={t} onClose={() => open(null)} onSaved={load} />}
    </div>
  );
}

function ReportModal({ r, t, onClose, onSaved }) {
  const [reply, setReply] = useState('');
  const [resolve, setResolve] = useState(true);
  const [status, setStatus] = useState(r.status);
  const [note, setNote] = useState(r.adminNote || '');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(['', false]);
  const run = async (what, work, done) => {
    setBusy(what); setMsg(['', false]);
    try { await work(); setMsg([done, true]); onSaved(); } catch (e) { setMsg([refusal(e, t('admin.saveFailed')), false]); }
    setBusy('');
  };
  const sendReply = () => {
    if (!reply.trim()) { setMsg([t('admin.replyNeeded'), false]); return; }
    run('reply', async () => { await replyToReport(r.id, reply.trim(), resolve); setReply(''); setStatus(resolve ? 'resolved' : 'in_progress'); }, t('admin.replySent'));
  };
  const row = (label, value) => value ? (
    <div style={{ display: 'flex', gap: 10, fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--border-subtle)' }}>
      <span style={{ width: 92, flexShrink: 0, color: 'var(--text-muted)' }}>{label}</span><span style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  ) : null;
  return (
    <Modal open onClose={onClose} title={r.subject} maxWidth={620}>
      <div data-report-detail style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Pill tone={KIND_TONE[r.kind]}>{t(`support.kind${r.kind[0].toUpperCase()}${r.kind.slice(1)}`)}</Pill>
          <Pill tone={STATUS_TONE[status]}>{t(`admin.report_${status}`)}</Pill>
          {!r.emailedAt && <Pill tone="grey">{t('admin.notEmailed')}</Pill>}
        </div>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.message}</div>
        <div>
          {row(t('admin.from'), `${r.senderName} (${t(`admin.role_${r.senderRole}`)})`)}
          {row(t('admin.colGym'), r.gym ? `${r.gym.name} (${r.gym.code})` : null)}
          {row(t('admin.email'), r.senderEmail && <a href={`mailto:${r.senderEmail}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', display: 'inline-flex', gap: 5, alignItems: 'center' }}><Mail size={12} />{r.senderEmail}</a>)}
          {row(t('admin.phone'), r.senderPhone && <a href={`tel:${String(r.senderPhone).replace(/[^\d+]/g, '')}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', display: 'inline-flex', gap: 5, alignItems: 'center' }}><Phone size={12} />{r.senderPhone}</a>)}
          {row(t('admin.page'), r.page)}
          {row(t('admin.sent'), day(r.createdAt))}
          {row(t('admin.browser'), r.userAgent)}
        </div>

        {r.reply && (
          <div style={{ borderLeft: '3px solid var(--accent-gold)', padding: '8px 12px', background: 'var(--accent-gold-dim)', borderRadius: '0 10px 10px 0' }}>
            <div style={{ fontSize: 11, color: 'var(--accent-gold)', fontWeight: 700, marginBottom: 4 }}>{t('admin.yourAnswer', { date: day(r.repliedAt) })}</div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{r.reply}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="report-reply" style={sectionLabel}>{r.reply ? t('admin.answerAgain') : t('admin.answer')}</label>
          <textarea id="report-reply" value={reply} onChange={e => setReply(e.target.value)} rows={4} maxLength={4000} placeholder={t('admin.answerPh')} style={{ ...field, resize: 'vertical' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" data-resolve checked={resolve} onChange={e => setResolve(e.target.checked)} style={{ accentColor: '#c9a96e', width: 16, height: 16 }} />
              {t('admin.markResolved')}
            </label>
            <button type="button" data-send-reply style={{ ...goldBtn, marginLeft: 'auto', opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={sendReply}><Send size={14} /> {t('admin.sendAnswer')}</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.senderEmail ? t('admin.answerGoesTo', { email: r.senderEmail }) : t('admin.answerInAppOnly')}</div>
        </div>

        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
          <GemSelect label={t('admin.colStatus')} value={status} onChange={e => { const v = e.target.value; setStatus(v); run('status', () => updateReport(r.id, { status: v }), t('admin.saved')); }}
            options={['new', 'in_progress', 'resolved'].map(s => ({ value: s, label: t(`admin.report_${s}`) }))} />
          <div />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="report-note" style={sectionLabel}>{t('admin.privateNote')}</label>
          <textarea id="report-note" value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={4000} placeholder={t('admin.reportNotePh')} style={{ ...field, resize: 'vertical' }} />
          <button type="button" data-save-report-note style={{ ...plainBtn, alignSelf: 'flex-start', opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => run('note', () => updateReport(r.id, { adminNote: note }), t('admin.saved'))}>{t('common.save')}</button>
        </div>
        {msg[0] && (msg[1] ? <div role="status" style={{ fontSize: 12.5, color: 'var(--accent-green)' }}>{msg[0]}</div> : <Problem>{msg[0]}</Problem>)}
      </div>
    </Modal>
  );
}
