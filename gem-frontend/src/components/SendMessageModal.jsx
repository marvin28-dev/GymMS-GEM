import { useState, useEffect, useRef } from 'react';
import { Mail, Send, CheckCircle2 } from 'lucide-react';
import Modal from './ui/Modal';
import { useLanguage } from '../contexts/LanguageContext';
import { create as sendCommunication, getChannels, previewAudience } from '../services/communications.service';
import FillInPreview from './FillInPreview';
import { serverFieldError, fieldErrorStyle, revealFirstError } from '../utils/formErrors';
import { hasEmail, TOKENS } from '../utils/fillIn';

// An email to one member or to a chosen few, sent for real through the
// Communication page's engine. Used by the member profile and the Members list.
export default function SendMessageModal({ open, onClose, members = [], onSent }) {
  const { t } = useLanguage();
  const [channels, setChannels] = useState(null);
  const [form, setForm] = useState({ subject: '', body: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [sample, setSample] = useState(null);
  const bodyRef = useRef(null);
  const single = members.length === 1;
  const withEmail = members.filter(hasEmail).length;
  const emailReady = channels ? !!channels.email?.ready : true;
  // Why it cannot go, if it cannot
  const blocked = !emailReady ? t('communication.emailNotReady')
    : !withEmail ? (single ? t('memberProfile.msgNoEmail') : t('communication.nobodyHasEmail')) : '';

  useEffect(() => {
    if (!open) return;
    setErrors({}); setBusy(false); setDone('');
    getChannels().then(r => setChannels(r.data)).catch(() => setChannels(null));
    setSample(null);
    if (members.length) previewAudience({ type: 'members', memberIds: members.map(m => m.id) }).then(r => setSample(r.data?.sample || null)).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(x => ({ ...x, [k]: undefined, _form: undefined })); };
  const insertToken = (key) => {
    const el = bodyRef.current, token = `{${key}}`;
    const start = el?.selectionStart ?? form.body.length, end = el?.selectionEnd ?? form.body.length;
    set('body', form.body.slice(0, start) + token + form.body.slice(end));
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(start + token.length, start + token.length); } });
  };

  const handleSend = async () => {
    const e = {};
    if (blocked) e._form = blocked;
    if (!form.subject.trim()) e.subject = t('communication.needSubject');
    if (!form.body.trim()) e.body = t('communication.needBody');
    setErrors(e);
    if (Object.keys(e).length) { revealFirstError(); return; }
    setBusy(true);
    try {
      await sendCommunication({ action: 'send', subject: form.subject.trim(), body: form.body.trim(), audience: { type: 'members', memberIds: members.map(m => m.id) } });
      setDone(single ? t('communication.sentToOne', { name: `${members[0].firstName || ''} ${members[0].lastName || ''}`.trim() }) : t('communication.sentToMany', { n: members.length }));
      setForm({ subject: '', body: '' });
      onSent?.();
      setTimeout(() => { setDone(''); onClose(); }, 1600);
    } catch (err) {
      const se = serverFieldError(err, t('communication.sendFailed'));
      setErrors(se.field && !['audience', 'channel'].includes(se.field) ? { [se.field]: se.message } : { _form: se.message });
    }
    setBusy(false);
  };

  if (!members.length) return null;
  const err = (k) => errors[k] && <span role="alert" style={fieldErrorStyle}>{errors[k]}</span>;
  const input = { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none', boxSizing: 'border-box', width: '100%' };
  const name = (m) => `${m.firstName || ''} ${m.lastName || ''}`.trim();
  const title = single ? t('communication.messageTo', { name: name(members[0]) }) : t('communication.messageToN', { n: members.length });

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={500}>
      {done ? (
        <div data-msg-done role="status" style={{ padding: '26px 0', textAlign: 'center', fontFamily: 'DM Sans' }}>
          <CheckCircle2 size={38} color="var(--accent-green)" style={{ display: 'block', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>{done}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{t('communication.followOnPage')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'DM Sans' }}>
          {!single && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {members.slice(0, 10).map(m => <span key={m.id} style={{ fontSize: 11.5, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '3px 10px', color: 'var(--text-secondary)' }}>{name(m)}</span>)}
              {members.length > 10 && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '3px 4px' }}>{t('communication.andNMore', { n: members.length - 10 })}</span>}
            </div>
          )}
          {/* Where it goes: the address, or how many of them have one */}
          <div data-msg-reach style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: withEmail ? 'var(--text-secondary)' : 'var(--accent-red)' }}>
            <Mail size={14} style={{ flexShrink: 0 }} />
            {single ? (members[0].email || t('memberProfile.msgNoEmail')) : t('communication.reachEmailOf', { n: withEmail, total: members.length })}
          </div>
          <div>
            <label htmlFor="msg-subject" style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('communication.subjectField')}</label>
            <input id="msg-subject" value={form.subject} maxLength={150} onChange={e => set('subject', e.target.value)} placeholder={t('communication.subjectPh')} style={{ ...input, borderColor: errors.subject ? 'var(--accent-red)' : 'var(--border-subtle)' }} />
            {err('subject')}
          </div>
          <div>
            <label htmlFor="msg-body" style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('communication.messageField')}</label>
            <textarea id="msg-body" ref={bodyRef} value={form.body} onChange={e => set('body', e.target.value)} rows={5} maxLength={5000}
              placeholder={t('communication.bodyPh')}
              style={{ ...input, resize: 'vertical', lineHeight: 1.55, minHeight: 110, borderColor: errors.body ? 'var(--accent-red)' : 'var(--border-subtle)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('communication.insert')}</span>
              {TOKENS.map(([key, lk]) => (
                <button key={key} type="button" data-token={key} onClick={() => insertToken(key)} title={t('communication.tokHint')}
                  style={{ padding: '3px 9px', borderRadius: 7, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'DM Sans' }}>+ {t(`communication.${lk}`)}</button>
              ))}
            </div>
            <FillInPreview body={form.body} subject={form.subject} sample={sample} />
            {err('body')}
          </div>
          {errors._form && <div role="alert" data-field-error style={{ fontSize: 12.5, color: 'var(--accent-red)' }}>{errors._form}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" onClick={onClose} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 10, fontSize: 13, fontWeight: 600, padding: '10px 16px', cursor: 'pointer', fontFamily: 'DM Sans' }}>{t('common.cancel')}</button>
            <button type="button" data-msg-send disabled={busy} onClick={handleSend}
              style={{ background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700, padding: '10px 18px', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'DM Sans', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Send size={14} /> {single ? t('communication.send') : t('communication.sendToN', { n: members.length })}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
