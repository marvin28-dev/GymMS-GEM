import { useState, useEffect, useRef } from 'react';
import { Mail, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import Modal from './ui/Modal';
import { useLanguage } from '../contexts/LanguageContext';
import { create as sendCommunication, getChannels, previewAudience } from '../services/communications.service';
import FillInPreview from './FillInPreview';
import { serverFieldError, fieldErrorStyle, revealFirstError } from '../utils/formErrors';
import { smsInfo, hasEmail, hasPhone, TOKENS, fillIn, hasFillIns } from '../utils/smsCount';

// An email or a text (or both) to one member or to a chosen few, sent for real
// through the Communication page's engine. Used by the member profile and the
// Members list. Only the ways the chosen people can be reached are offered.
const wants = (channel, kind) => channel === kind || channel === 'both';

export default function SendMessageModal({ open, onClose, members = [], onSent }) {
  const { t } = useLanguage();
  const [channels, setChannels] = useState(null);
  const [form, setForm] = useState({ channel: 'email', subject: '', body: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [sample, setSample] = useState(null);
  const bodyRef = useRef(null);
  const single = members.length === 1;
  const withEmail = members.filter(hasEmail).length;
  const withPhone = members.filter(hasPhone).length;
  const emailOk = withEmail > 0 && (channels ? channels.email?.ready : true);
  const textOk = withPhone > 0 && !!channels?.sms?.ready;
  const ok = { email: emailOk, sms: textOk, both: emailOk && textOk };
  // counted as it will really go out, names filled in
  const sms = smsInfo(sample && hasFillIns(form.body) ? fillIn(form.body, sample) : form.body);

  useEffect(() => {
    if (!open) return;
    setErrors({}); setBusy(false); setDone('');
    getChannels().then(r => setChannels(r.data)).catch(() => setChannels(null));
    setSample(null);
    if (members.length) previewAudience({ type: 'members', memberIds: members.map(m => m.id) }).then(r => setSample(r.data?.sample || null)).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Start on a way that reaches them
  useEffect(() => {
    if (!open) return;
    setForm(f => ({ ...f, channel: ok[f.channel] ? f.channel : emailOk ? 'email' : textOk ? 'sms' : f.channel }));
  }, [open, emailOk, textOk]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(x => ({ ...x, [k]: undefined, _form: undefined })); };
  const insertToken = (key) => {
    const el = bodyRef.current, token = `{${key}}`;
    const start = el?.selectionStart ?? form.body.length, end = el?.selectionEnd ?? form.body.length;
    set('body', form.body.slice(0, start) + token + form.body.slice(end));
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(start + token.length, start + token.length); } });
  };
  const why = (k) => {
    if (k !== 'sms' && !emailOk) return single ? t('memberProfile.msgNoEmail') : t('communication.nobodyHasEmail');
    if (k !== 'email' && !channels?.sms?.ready) return t('communication.smsNotReady');
    if (k !== 'email' && !textOk) return single ? t('memberProfile.msgNoPhone') : t('communication.nobodyHasPhone');
    return undefined;
  };

  const handleSend = async () => {
    const e = {};
    if (!ok[form.channel]) e.channel = why(form.channel);
    if (wants(form.channel, 'email') && !form.subject.trim()) e.subject = t('communication.needSubject');
    if (!form.body.trim()) e.body = t('communication.needBody');
    else if (wants(form.channel, 'sms') && sms.parts > 6) e.body = t('communication.tooLongForText');
    setErrors(e);
    if (Object.keys(e).length) { revealFirstError(); return; }
    setBusy(true);
    try {
      await sendCommunication({ action: 'send', channel: form.channel, subject: form.subject.trim(), body: form.body.trim(), audience: { type: 'members', memberIds: members.map(m => m.id) } });
      setDone(single ? t('communication.sentToOne', { name: `${members[0].firstName || ''} ${members[0].lastName || ''}`.trim() }) : t('communication.sentToMany', { n: members.length }));
      setForm(f => ({ channel: f.channel, subject: '', body: '' }));
      onSent?.();
      setTimeout(() => { setDone(''); onClose(); }, 1600);
    } catch (err) {
      const se = serverFieldError(err, t('communication.sendFailed'));
      setErrors(se.field && se.field !== 'audience' ? { [se.field]: se.message } : { _form: se.message });
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
          <div>
            <div role="radiogroup" aria-label={t('communication.sendBy')} style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-elevated)', borderRadius: 12, border: `1px solid ${errors.channel ? 'var(--accent-red)' : 'var(--border-subtle)'}` }}>
              {[['email', Mail], ['sms', MessageSquare], ['both', Send]].map(([k, Icon]) => (
                <button key={k} type="button" role="radio" aria-checked={form.channel === k} data-msg-channel={k} disabled={!ok[k]} title={!ok[k] ? why(k) : undefined}
                  onClick={() => set('channel', k)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 6px', borderRadius: 9, border: 'none', cursor: ok[k] ? 'pointer' : 'not-allowed', opacity: ok[k] ? 1 : 0.4, fontSize: 13, fontWeight: form.channel === k ? 700 : 500, fontFamily: 'DM Sans', background: form.channel === k ? 'var(--bg-card)' : 'transparent', color: form.channel === k ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                  <Icon size={14} /> {t(`communication.ch_${k}`)}
                </button>
              ))}
            </div>
            <div data-msg-reach style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 7 }}>
              {single
                ? [wants(form.channel, 'email') && (members[0].email || t('memberProfile.msgNoEmail')), wants(form.channel, 'sms') && (members[0].phone || t('memberProfile.msgNoPhone'))].filter(Boolean).join(' · ')
                : [wants(form.channel, 'email') && t('communication.reachEmailOf', { n: withEmail, total: members.length }), wants(form.channel, 'sms') && t('communication.reachSmsOf', { n: withPhone, total: members.length })].filter(Boolean).join(' · ')}
            </div>
            {err('channel')}
          </div>
          {wants(form.channel, 'email') && (
            <div>
              <label htmlFor="msg-subject" style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('communication.subjectField')}</label>
              <input id="msg-subject" value={form.subject} maxLength={150} onChange={e => set('subject', e.target.value)} placeholder={t('communication.subjectPh')} style={{ ...input, borderColor: errors.subject ? 'var(--accent-red)' : 'var(--border-subtle)' }} />
              {err('subject')}
            </div>
          )}
          <div>
            <label htmlFor="msg-body" style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: 6 }}>{t('communication.messageField')}</label>
            <textarea id="msg-body" ref={bodyRef} value={form.body} onChange={e => set('body', e.target.value)} rows={5} maxLength={5000}
              placeholder={t(form.channel === 'sms' ? 'communication.bodyPhSms' : 'communication.bodyPh')}
              style={{ ...input, resize: 'vertical', lineHeight: 1.55, minHeight: 110, borderColor: errors.body ? 'var(--accent-red)' : 'var(--border-subtle)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('communication.insert')}</span>
              {TOKENS.map(([key, lk]) => (
                <button key={key} type="button" data-token={key} onClick={() => insertToken(key)} title={t('communication.tokHint')}
                  style={{ padding: '3px 9px', borderRadius: 7, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'DM Sans' }}>+ {t(`communication.${lk}`)}</button>
              ))}
              {wants(form.channel, 'sms') && form.body && (
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: sms.parts > 6 ? 'var(--accent-red)' : sms.parts > 1 ? 'var(--accent-yellow)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {t(sms.parts === 1 ? 'communication.smsOne' : 'communication.smsParts', { len: sms.len, limit: sms.limit, n: sms.parts })}
                </span>
              )}
            </div>
            <FillInPreview body={form.body} subject={wants(form.channel, 'email') ? form.subject : ''} sample={sample} />
            {err('body')}
          </div>
          {errors._form && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)' }}>{errors._form}</div>}
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
