import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mail, MessageSquare, Send, Clock, FileText, Trash2, Eye, RefreshCw, X, Pencil, Ban, Info, Loader2, Users,
} from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useLiveTick } from '../hooks/useLiveRefresh';
import PageHeader from '../components/ui/PageHeader';
import ConfirmModal from '../components/ui/ConfirmModal';
import Modal from '../components/ui/Modal';
import RowMenu from '../components/ui/RowMenu';
import TimeInput from '../components/ui/TimeInput';
import { SkeletonCards, SkeletonTableRows } from '../components/Skeleton';
import { useLanguage } from '../contexts/LanguageContext';
import { getAll as getMembers } from '../services/members.service';
import { getAll as getPackages } from '../services/packages.service';
import {
  getAll as getCommunications, getOne, getChannels, previewAudience, create as createCommunication,
  retry as retryCommunication, cancelSchedule, remove as removeCommunication,
} from '../services/communications.service';
import { fmtDate, todayStr, dayStr } from '../utils/date';
import { softAll } from '../utils/loadAll';
import { gymCache } from '../utils/gymCache';
import { serverFieldError, fieldErrorStyle, revealFirstError } from '../utils/formErrors';
import { smsInfo, TOKENS, fillIn, hasFillIns } from '../utils/smsCount';
import FillInPreview from '../components/FillInPreview';

// Messages to members by email, text (SMS) or both. The server works out who an
// audience reaches when it sends, fills in each person's name, end date and
// balance, and records every delivery; this page writes, schedules and follows them.

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 14, boxShadow: 'var(--shadow-card)' };
const input = { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box' };
const label = { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 7, display: 'block', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 };
const goldBtn = { background: 'linear-gradient(135deg, #c9a96e, #b08d4a)', color: '#0a0a0f', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 700, padding: '11px 18px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 };
const plainBtn = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 10, fontSize: 13, fontWeight: 600, padding: '10px 16px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 };
const chip = (on) => ({
  padding: '7px 13px', borderRadius: 20, fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
  border: `1px solid ${on ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: on ? 'var(--accent-gold-dim)' : 'transparent', color: on ? 'var(--accent-gold)' : 'var(--text-secondary)',
});

const AUDIENCES = ['all', 'active', 'ending', 'inactive', 'owing', 'package', 'members'];
const STATUS_FILTERS = ['all', 'sent', 'scheduled', 'draft', 'failed'];
const wants = (channel, kind) => channel === kind || channel === 'both';


// "1 person" / "3 people": key1 is the singular form
const nt = (t, key, vars) => (vars.n === 1 ? t(`${key}1`, vars) : t(key, vars));

const emptyDraft = () => ({ id: null, channel: 'email', audience: { type: 'all' }, picked: [], subject: '', body: '', when: 'now', date: '', time: '' });

export default function CommunicationPage() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const cache = gymCache('comms2');
  const [history, setHistory] = useState(() => cache.read('history', []));
  const [loading, setLoading] = useState(() => !cache.has('history'));
  const [channels, setChannels] = useState(null);
  const [packages, setPackages] = useState([]);
  const [members, setMembers] = useState([]);
  const [d, setD] = useState(emptyDraft);
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [viewId, setViewId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [mobileTab, setMobileTab] = useState('compose');
  const [search, setSearch] = useState('');
  const [showPeople, setShowPeople] = useState(false);
  // A refused unschedule, delete or retry is shown above the history (F-120)
  const [historyError, setHistoryError] = useState('');
  const bodyRef = useRef(null);
  const set = (patch) => { setD(prev => ({ ...prev, ...patch })); setErrors(e => { const n = { ...e }; Object.keys(patch).forEach(k => { delete n[k]; }); delete n._form; return n; }); };

  // ── Loading, and following messages while they go out ──
  const liveTick = useLiveTick(['communications', 'members', 'packages']);
  const load = useCallback(() => softAll([getCommunications(), getChannels(), getPackages(), getMembers()])
    .then(([c, ch, p, m]) => {
      const list = c.data || [];
      setHistory(list); cache.write('history', list);
      if (ch.data) setChannels(ch.data);
      setPackages(p.data || []);
      setMembers((m.data || []).filter(x => x.status !== 'deactivated'));
    })
    .catch(console.error)
    .finally(() => setLoading(false)), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, liveTick]);
  const sendingNow = history.some(c => c.status === 'sending');
  useEffect(() => {
    if (!sendingNow) return undefined;
    const timer = setInterval(() => getCommunications().then(r => { setHistory(r.data || []); cache.write('history', r.data || []); }).catch(() => {}), 2000);
    return () => clearInterval(timer);
  }, [sendingNow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Who it reaches, counted by the server as the choice changes
  const audienceKey = JSON.stringify(d.audience);
  useEffect(() => {
    if (d.audience.type === 'package' && !d.audience.packageId) { setPreview(null); return undefined; }
    if (d.audience.type === 'members' && !d.audience.memberIds?.length) { setPreview({ total: 0, withEmail: 0, withPhone: 0, key: audienceKey }); return undefined; }
    let alive = true;
    const timer = setTimeout(() => previewAudience(d.audience).then(r => { if (alive) setPreview({ ...r.data, key: audienceKey }); }).catch(() => {}), 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [audienceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const smsReady = !!channels?.sms?.ready;
  const emailReady = channels ? !!channels.email?.ready : true;
  // the first person's own values, once the count is for the current choice
  const sample = preview?.key === audienceKey ? preview?.sample || null : null;
  // a text is counted as it will really go out, names filled in
  const sms = smsInfo(sample && hasFillIns(d.body) ? fillIn(d.body, sample) : d.body);
  const reach = preview ? {
    total: preview.total,
    email: wants(d.channel, 'email') ? preview.withEmail : 0,
    sms: wants(d.channel, 'sms') ? preview.withPhone : 0,
  } : null;

  // ── Writing ──
  const insertToken = (key) => {
    const el = bodyRef.current;
    const token = `{${key}}`;
    const start = el?.selectionStart ?? d.body.length, end = el?.selectionEnd ?? d.body.length;
    const next = d.body.slice(0, start) + token + d.body.slice(end);
    set({ body: next });
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(start + token.length, start + token.length); } });
  };
  const pickMember = (m) => {
    if (d.picked.some(p => p.id === m.id)) return;
    const picked = [...d.picked, m];
    set({ picked, audience: { type: 'members', memberIds: picked.map(p => p.id) } });
    setSearch('');
  };
  const unpick = (id) => {
    const picked = d.picked.filter(p => p.id !== id);
    set({ picked, audience: { type: 'members', memberIds: picked.map(p => p.id) } });
  };
  const chooseAudience = (type) => {
    if (type === 'members') set({ audience: { type, memberIds: d.picked.map(p => p.id) } });
    else if (type === 'package') set({ audience: { type, packageId: d.audience.packageId || '' } });
    else set({ audience: { type } });
  };
  const scheduledAt = () => (d.date && d.time ? new Date(`${d.date}T${d.time}:00`) : null);

  const check = (action, counted = preview) => {
    const e = {};
    if (action !== 'draft') {
      if (wants(d.channel, 'sms') && !smsReady) e.channel = t('communication.smsNotReady');
      if (wants(d.channel, 'email') && !d.subject.trim()) e.subject = t('communication.needSubject');
      if (!d.body.trim()) e.body = t('communication.needBody');
      else if (wants(d.channel, 'sms') && sms.parts > 6) e.body = t('communication.tooLongForText');
      if (d.audience.type === 'package' && !d.audience.packageId) e.audience = t('communication.choosePackage');
      else if (d.audience.type === 'members' && !d.picked.length) e.audience = t('communication.choosePeople');
      else if (counted && counted.total === 0) e.audience = t('communication.nobodyMatches');
      if (action === 'schedule') {
        const at = scheduledAt();
        if (!at) e.scheduledAt = t('communication.chooseWhen');
        else if (at.getTime() < Date.now()) e.scheduledAt = t('communication.whenPassed');
      }
    } else if (!d.subject.trim() && !d.body.trim()) e.body = t('communication.needSomething');
    setErrors(e);
    if (Object.keys(e).length) { revealFirstError(); return false; }
    return true;
  };

  const submit = async (action, people = preview?.total ?? 0) => {
    setBusy(true); setNotice('');
    try {
      const res = await createCommunication({
        id: d.id || undefined, action, channel: d.channel, subject: d.subject.trim(), body: d.body.trim(), audience: d.audience,
        scheduledAt: action === 'schedule' ? scheduledAt()?.toISOString() : undefined,
      });
      const n = people;
      setNotice(action === 'draft' ? t('communication.draftSaved') : action === 'schedule'
        ? nt(t, 'communication.scheduledFor', { when: `${fmtDate(scheduledAt())} ${d.time}`, n })
        : nt(t, 'communication.sendingTo', { n }));
      setHistory(prev => [res.data, ...prev.filter(c => c.id !== res.data.id)]);
      setD(emptyDraft()); setErrors({}); setSearch('');
      if (isMobile && action !== 'draft') setMobileTab('history');
      load();
    } catch (err) {
      const se = serverFieldError(err, t('communication.sendFailed'));
      setErrors(se.field ? { [se.field]: se.message } : { _form: se.message });
    }
    setBusy(false); setConfirm(null);
  };

  const onSend = async (action) => {
    if (action === 'draft') { if (check(action)) submit('draft'); return; }
    // Count again if the choice changed since the last count
    let counted = preview;
    if (preview?.key !== audienceKey && !(d.audience.type === 'package' && !d.audience.packageId) && !(d.audience.type === 'members' && !d.picked.length)) {
      try { counted = { ...(await previewAudience(d.audience)).data, key: audienceKey }; setPreview(counted); } catch { counted = null; }
    }
    if (!check(action, counted)) return;
    // More than one person: say exactly what goes out before it goes
    if ((counted?.total ?? 0) > 1) setConfirm(action); else submit(action, counted?.total ?? 0);
  };

  const openDraft = (c) => {
    const a = c.audience || { type: 'all' };
    const picked = a.type === 'members' ? (a.memberIds || []).map(id => members.find(m => m.id === id)).filter(Boolean) : [];
    const at = c.scheduledAt ? new Date(c.scheduledAt) : null;
    setD({
      id: c.id, channel: c.channel || 'email', audience: a, picked, subject: c.subject || '', body: c.body || '',
      when: c.status === 'scheduled' ? 'later' : 'now',
      date: at ? dayStr(at) : '', time: at ? `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` : '',
    });
    setErrors({}); setNotice('');
    if (isMobile) setMobileTab('compose');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── History ──
  const titleOf = (c) => (c.channel === 'sms' ? c.body : c.subject) || c.body || t('communication.untitled');
  const pkgName = (id) => packages.find(p => p.id === id)?.name || '';
  const audienceText = (c) => {
    const a = c.audience;
    if (!a) return c.targetGroup || '';
    if (a.type === 'members') return c.total === 1 ? (c.targetGroup || t('communication.onePerson')) : t('communication.audPickedN', { n: c.total });
    if (a.type === 'package') return t('communication.audPackageN', { name: pkgName(a.packageId), n: c.total });
    return `${t(`communication.aud_${a.type}`)} (${c.total})`;
  };
  const when = (c) => {
    const at = c.status === 'scheduled' ? c.scheduledAt : (c.sentAt || c.createdAt);
    const dt = new Date(at);
    return `${fmtDate(dt, { day: 'numeric', month: 'short' })}, ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  };
  const shown = history.filter(c => filter === 'all'
    || (filter === 'sent' && ['sent', 'partial', 'sending'].includes(c.status))
    || (filter === 'failed' && (c.status === 'failed' || c.emailFailed + c.smsFailed > 0))
    || c.status === filter);
  const countOf = (f) => (f === 'all' ? history.length : history.filter(c => (f === 'sent' ? ['sent', 'partial', 'sending'].includes(c.status) : f === 'failed' ? (c.status === 'failed' || c.emailFailed + c.smsFailed > 0) : c.status === f)).length);

  const doRetry = async (id) => {
    setHistoryError('');
    try { await retryCommunication(id); setNotice(t('communication.retrying')); load(); } catch (err) { setHistoryError(err?.response?.data?.error || t('communication.sendFailed')); }
  };
  const doUnschedule = async (id) => {
    setHistoryError('');
    try { await cancelSchedule(id); load(); } catch (err) { setHistoryError(err?.response?.data?.error || t('communication.unscheduleFailed')); }
  };
  const doDelete = async (id) => {
    const before = history;
    setHistoryError('');
    setHistory(h => h.filter(c => c.id !== id));
    try { await removeCommunication(id); } catch (err) { setHistory(before); setHistoryError(err?.response?.data?.error || t('communication.deleteFailed')); }
  };
  const menuFor = (c) => [
    { label: t('common.view'), icon: <Eye size={15} />, onClick: () => setViewId(c.id), hidden: c.status === 'draft' },
    { label: t('communication.editDraft'), icon: <Pencil size={15} />, onClick: () => openDraft(c), hidden: !['draft', 'scheduled'].includes(c.status) },
    { label: t('communication.unschedule'), icon: <Ban size={15} />, onClick: () => doUnschedule(c.id), hidden: c.status !== 'scheduled' },
    { label: t('communication.retryFailed'), icon: <RefreshCw size={15} />, onClick: () => doRetry(c.id), hidden: !(c.emailFailed + c.smsFailed > 0) || c.status === 'sending' },
    { label: t('common.delete'), icon: <Trash2 size={15} />, onClick: () => setDeleteId(c.id), danger: true, hidden: c.status === 'sending' },
  ];

  // ── Pieces ──
  const err = (k) => errors[k] && <span role="alert" style={fieldErrorStyle}>{errors[k]}</span>;
  const ChannelIcons = ({ channel, size = 13 }) => (
    <span style={{ display: 'inline-flex', gap: 4, color: 'var(--text-secondary)' }} title={t(`communication.ch_${channel || 'email'}`)}>
      {wants(channel || 'email', 'email') && <Mail size={size} />}{wants(channel, 'sms') && <MessageSquare size={size} />}
    </span>
  );

  const banners = channels && [
    channels.email?.testMode && wants(d.channel, 'email') && t('communication.emailTestMode'),
    !smsReady && t('communication.smsOff'),
    smsReady && channels.sms?.testMode && wants(d.channel, 'sms') && t('communication.smsTestMode'),
  ].filter(Boolean);

  const compose = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {d.id && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--accent-gold)', fontFamily: 'DM Sans' }}>
          <Pencil size={13} /> {t('communication.editingDraft')}
          <button type="button" onClick={() => { setD(emptyDraft()); setErrors({}); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12.5, fontFamily: 'DM Sans' }}>{t('communication.startNew')}</button>
        </div>
      )}
      {banners?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {banners.map(b => (
            <div key={b} data-channel-note style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 12px', fontFamily: 'DM Sans' }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent-gold)' }} />{b}
            </div>
          ))}
        </div>
      )}

      {/* How it goes */}
      <div>
        <span style={label}>{t('communication.sendBy')}</span>
        <div role="radiogroup" aria-label={t('communication.sendBy')} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 4, background: 'var(--bg-elevated)', borderRadius: 12, border: `1px solid ${errors.channel ? 'var(--accent-red)' : 'var(--border-subtle)'}` }}>
          {[['email', Mail], ['sms', MessageSquare], ['both', Send]].map(([k, Icon]) => {
            const on = d.channel === k;
            const off = (k !== 'email' && !smsReady) || (k !== 'sms' && !emailReady);
            return (
              <button key={k} type="button" role="radio" aria-checked={on} data-channel={k} disabled={off} title={off ? t('communication.smsOff') : undefined}
                onClick={() => set({ channel: k })}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 6px', borderRadius: 9, border: 'none', cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.4 : 1, fontSize: 13, fontWeight: on ? 700 : 500, fontFamily: 'DM Sans', background: on ? 'var(--bg-card)' : 'transparent', color: on ? 'var(--accent-gold)' : 'var(--text-secondary)', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.2)' : 'none' }}>
                <Icon size={14} /> {t(`communication.ch_${k}`)}
              </button>
            );
          })}
        </div>
        {err('channel')}
      </div>

      {/* Who it is for */}
      <div>
        <span style={label}>{t('communication.to')}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {AUDIENCES.map(a => <button key={a} type="button" data-audience={a} aria-pressed={d.audience.type === a} onClick={() => chooseAudience(a)} style={chip(d.audience.type === a)}>{t(`communication.aud_${a}`)}</button>)}
        </div>
        {d.audience.type === 'package' && (
          <select value={d.audience.packageId || ''} onChange={e => set({ audience: { type: 'package', packageId: e.target.value } })} style={{ ...input, marginTop: 10, cursor: 'pointer' }} aria-label={t('communication.aud_package')}>
            <option value="">{t('communication.choosePackage')}</option>
            {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {d.audience.type === 'members' && (
          <div style={{ marginTop: 10 }}>
            {d.picked.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {d.picked.map(m => (
                  <span key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', borderRadius: 20, padding: '4px 6px 4px 11px', fontSize: 12.5, fontFamily: 'DM Sans' }}>
                    {m.firstName} {m.lastName}
                    <button type="button" onClick={() => unpick(m.id)} aria-label={t('common.remove')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('communication.findPeople')} style={input} aria-label={t('communication.findPeople')} />
              {search.trim() && (() => {
                const q = search.trim().toLowerCase();
                const found = members.filter(m => !d.picked.some(p => p.id === m.id) && (`${m.firstName} ${m.lastName}`.toLowerCase().includes(q) || String(m.memberCode || '').toLowerCase().includes(q) || String(m.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '#'))).slice(0, 8);
                return found.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 50, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-elevated)', padding: 4, maxHeight: 260, overflowY: 'auto' }}>
                    {found.map(m => (
                      <button key={m.id} type="button" data-pick={m.id} onClick={() => pickMember(m)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{m.firstName} {m.lastName}</span>
                        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, color: 'var(--text-muted)' }}>
                          <Mail size={12} style={{ opacity: m.email ? 1 : 0.25 }} /><MessageSquare size={12} style={{ opacity: m.phone ? 1 : 0.25 }} />
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {reach && (
          <div data-reach style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
            {/* A group can be opened to see everyone on it, and people taken off */}
            {d.audience.type !== 'members' ? (
              <button type="button" data-see-people onClick={() => setShowPeople(true)} title={t('communication.seeWhoHint')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-gold-dim)', border: '1px solid transparent', borderRadius: 20, padding: '4px 11px 4px 9px', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'DM Sans', fontSize: 12.5 }}>
                <Users size={13} color="var(--accent-gold)" />
                <b>{nt(t, 'communication.peopleN', { n: reach.total })}</b>
                <span style={{ color: 'var(--accent-gold)', fontWeight: 600, fontSize: 12 }}>{t('communication.seeWho')}</span>
              </button>
            ) : (
              <><Users size={13} color="var(--accent-gold)" /><b style={{ color: 'var(--text-primary)' }}>{nt(t, 'communication.peopleN', { n: reach.total })}</b></>
            )}
            {(d.audience.excludeIds || []).length > 0 && <span data-left-out style={{ whiteSpace: 'nowrap', color: 'var(--accent-yellow)' }}>· {nt(t, 'communication.leftOutN', { n: d.audience.excludeIds.length })}</span>}
            {wants(d.channel, 'email') && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>· <Mail size={11} /> {t('communication.reachEmail', { n: reach.email })}</span>}
            {wants(d.channel, 'sms') && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>· <MessageSquare size={11} /> {t('communication.reachSms', { n: reach.sms })}</span>}
          </div>
        )}
        {err('audience')}
      </div>

      {/* Subject, for email */}
      {wants(d.channel, 'email') && (
        <div>
          <label style={label} htmlFor="comm-subject">{t('communication.subjectField')}</label>
          <input id="comm-subject" value={d.subject} maxLength={150} onChange={e => set({ subject: e.target.value })} placeholder={t('communication.subjectPh')} style={{ ...input, borderColor: errors.subject ? 'var(--accent-red)' : 'var(--border-subtle)' }} />
          {err('subject')}
        </div>
      )}

      {/* The message */}
      <div>
        <label style={label} htmlFor="comm-body">{t('communication.messageField')}</label>
        <textarea id="comm-body" ref={bodyRef} value={d.body} onChange={e => set({ body: e.target.value })} rows={isMobile ? 6 : 7} maxLength={5000}
          placeholder={t(d.channel === 'sms' ? 'communication.bodyPhSms' : 'communication.bodyPh')}
          style={{ ...input, resize: 'vertical', lineHeight: 1.55, minHeight: 130, fontSize: isMobile ? 16 : 13.5, borderColor: errors.body ? 'var(--accent-red)' : 'var(--border-subtle)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>{t('communication.insert')}</span>
          {TOKENS.map(([key, lk]) => (
            <button key={key} type="button" data-token={key} onClick={() => insertToken(key)} title={t('communication.tokHint')}
              style={{ padding: '3px 9px', borderRadius: 7, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11.5, cursor: 'pointer', fontFamily: 'DM Sans' }}>
              + {t(`communication.${lk}`)}
            </button>
          ))}
          {wants(d.channel, 'sms') && d.body && (
            <span data-sms-count style={{ marginLeft: 'auto', fontSize: 11.5, color: sms.parts > 6 ? 'var(--accent-red)' : sms.parts > 1 ? 'var(--accent-yellow)' : 'var(--text-muted)', fontFamily: 'DM Sans', fontVariantNumeric: 'tabular-nums' }}>
              {t(sms.parts === 1 ? 'communication.smsOne' : 'communication.smsParts', { len: sms.len, limit: sms.limit, n: sms.parts })}
            </span>
          )}
        </div>
        <FillInPreview body={d.body} subject={wants(d.channel, 'email') ? d.subject : ''} sample={sample} />
        {err('body')}
      </div>

      {/* When */}
      <div>
        <span style={label}>{t('communication.when')}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['now', 'later'].map(w => <button key={w} type="button" aria-pressed={d.when === w} data-when={w} onClick={() => set({ when: w })} style={chip(d.when === w)}>{w === 'now' ? t('communication.now') : t('communication.later')}</button>)}
        </div>
        {d.when === 'later' && (
          <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <input type="date" value={d.date} min={todayStr()} onChange={e => set({ date: e.target.value, scheduledAt: undefined })} aria-label={t('communication.date')} style={{ ...input, borderColor: errors.scheduledAt ? 'var(--accent-red)' : 'var(--border-subtle)' }} />
            <TimeInput value={d.time} onChange={e => set({ time: e.target.value, scheduledAt: undefined })} aria-label={t('communication.time')} style={{ ...(errors.scheduledAt ? { borderColor: 'var(--accent-red)' } : {}) }} />
          </div>
        )}
        {err('scheduledAt')}
      </div>

      {errors._form && <div role="alert" style={{ fontSize: 12.5, color: 'var(--accent-red)', fontFamily: 'DM Sans' }}>{errors._form}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4 }}>
        <button type="button" data-send style={{ ...goldBtn, flex: isMobile ? '1 1 100%' : '0 0 auto', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => onSend(d.when === 'later' ? 'schedule' : 'send')}>
          {d.when === 'later' ? <Clock size={15} /> : <Send size={15} />}
          {d.when === 'later'
            ? (reach?.total ? nt(t, 'communication.scheduleForN', { n: reach.total }) : t('communication.schedule'))
            : (reach?.total ? nt(t, 'communication.sendToN', { n: reach.total }) : t('communication.send'))}
        </button>
        <button type="button" data-save-draft style={plainBtn} disabled={busy} onClick={() => onSend('draft')}><FileText size={14} /> {t('communication.saveDraft')}</button>
      </div>
      {notice && <div role="status" data-notice style={{ fontSize: 12.5, color: 'var(--accent-green)', fontFamily: 'DM Sans' }}>{notice}</div>}
    </div>
  );

  const statusPill = (c) => {
    const failed = (c.emailFailed || 0) + (c.smsFailed || 0), sent = (c.emailSent || 0) + (c.smsSent || 0);
    const look = {
      draft: ['var(--text-muted)', 'rgba(140,140,150,0.14)', t('communication.st_draft')],
      scheduled: ['var(--accent-blue)', 'var(--accent-blue-dim)', t('communication.st_scheduled')],
      sending: ['var(--accent-gold)', 'var(--accent-gold-dim)', t('communication.st_sending')],
      sent: ['var(--accent-green)', 'var(--accent-green-dim)', c.total ? t('communication.st_sentN', { n: sent }) : t('communication.st_sent')],
      partial: ['var(--accent-yellow)', 'var(--accent-yellow-dim)', t('communication.st_partial', { n: sent, f: failed })],
      failed: ['var(--accent-red)', 'var(--accent-red-dim)', t('communication.st_failed')],
    }[c.status] || ['var(--text-muted)', 'transparent', c.status];
    return (
      <span data-status={c.status} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', color: look[0], background: look[1], fontFamily: 'DM Sans' }}>
        {c.status === 'sending' ? <Loader2 size={11} className="gem-spin" /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: look[0] }} />}
        {look[2]}
        {c.testMode && <span style={{ fontWeight: 500, opacity: 0.8 }}>· {t('communication.test')}</span>}
      </span>
    );
  };

  const filters = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {STATUS_FILTERS.map(f => (
        <button key={f} type="button" data-filter={f} aria-pressed={filter === f} onClick={() => setFilter(f)} style={{ ...chip(filter === f), padding: '5px 11px', fontSize: 12 }}>
          {t(`communication.f_${f}`)} <span style={{ opacity: 0.7, marginLeft: 2 }}>{countOf(f)}</span>
        </button>
      ))}
    </div>
  );

  const historyProblem = historyError && (
    <div role="alert" data-history-error style={{ fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '10px 14px', fontFamily: 'DM Sans', lineHeight: 1.5, ...(isMobile ? {} : { margin: '12px 22px 0' }) }}>{historyError}</div>
  );
  const historyList = isMobile ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {loading ? <SkeletonCards count={3} /> : shown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>{t('communication.nothingHere')}</div>
      ) : shown.map(c => (
        <div key={c.id} data-message-row={c.status} style={{ ...card, padding: '12px 14px', display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }} onClick={() => (c.status === 'draft' ? openDraft(c) : setViewId(c.id))}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChannelIcons channel={c.channel} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'DM Sans', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(c)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans', margin: '4px 0 6px' }}>{audienceText(c)} · {when(c)}</div>
            {statusPill(c)}
          </div>
          <RowMenu title={t('common.actions')} items={menuFor(c)} />
        </div>
      ))}
    </div>
  ) : (
    <div className="gem-table-scroll" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'DM Sans' }}>
        <thead>
          <tr>{[t('communication.colMessage'), t('communication.colTo'), t('communication.colWhen'), t('communication.colResult'), ''].map((h, i) => (
            <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {loading && <SkeletonTableRows rows={4} cols={5} />}
          {!loading && shown.length === 0 && (
            <tr><td colSpan={5} style={{ padding: '30px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('communication.nothingHere')}</td></tr>
          )}
          {!loading && shown.map(c => (
            <tr key={c.id} data-message-row={c.status} style={{ cursor: 'pointer' }} onClick={() => (c.status === 'draft' ? openDraft(c) : setViewId(c.id))}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', maxWidth: 280 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChannelIcons channel={c.channel} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(c)}</span>
                </div>
                {c.channel !== 'sms' && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.body}</div>}
              </td>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{audienceText(c)}</td>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{when(c)}</td>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>{statusPill(c)}</td>
              <td style={{ padding: '12px 8px', borderBottom: '1px solid var(--border-subtle)' }} onClick={e => e.stopPropagation()}>
                <RowMenu title={t('common.actions')} items={menuFor(c)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const confirmText = confirm && (() => {
    const n = reach?.total ?? 0;
    const lines = [];
    if (wants(d.channel, 'email')) lines.push(nt(t, 'communication.confirmEmails', { n: reach.email }));
    if (wants(d.channel, 'sms')) lines.push(nt(t, sms.parts > 1 ? 'communication.confirmTextsParts' : 'communication.confirmTexts', { n: reach.sms, parts: sms.parts }));
    const missing = Math.max(0, n - Math.max(reach.email, reach.sms));
    return `${confirm === 'schedule' ? t('communication.confirmSchedule', { n, when: `${fmtDate(scheduledAt())} ${d.time}` }) : t('communication.confirmSend', { n })} ${lines.join(' ')}${missing ? ` ${nt(t, 'communication.confirmMissing', { n: missing })}` : ''}`;
  })();

  return (
    <div style={{ fontFamily: 'DM Sans, sans-serif', ...(isMobile ? { padding: '0 16px 90px' } : {}) }}>
      <style>{'@keyframes gemSpin { to { transform: rotate(360deg) } } .gem-spin { animation: gemSpin 0.9s linear infinite }'}</style>
      {isMobile ? (
        <>
          <div style={{ padding: '16px 0 10px' }}>
            <h1 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('communication.title')}</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>{t('communication.subtitle2')}</p>
          </div>
          <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: 14 }}>
            {[['compose', t('communication.newMessage')], ['history', t('communication.history')]].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={mobileTab === k} onClick={() => setMobileTab(k)} style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `2px solid ${mobileTab === k ? 'var(--accent-gold)' : 'transparent'}`, color: mobileTab === k ? 'var(--accent-gold)' : 'var(--text-muted)', fontWeight: mobileTab === k ? 700 : 500, fontFamily: 'DM Sans' }}>{l}</button>
            ))}
          </div>
          {mobileTab === 'compose' ? compose : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{filters}{historyProblem}{historyList}</div>}
        </>
      ) : (
        <>
          <PageHeader title={t('communication.title')} subtitle={t('communication.subtitle2')} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
            <section style={{ ...card, flex: '1 1 420px', maxWidth: 540 }} aria-label={t('communication.newMessage')}>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('communication.newMessage')}</div>
              <div style={{ padding: 22 }}>{compose}</div>
            </section>
            <section style={{ ...card, flex: '999 1 480px', minWidth: 0 }} aria-label={t('communication.history')}>
              <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t('communication.history')}</span>
                <span style={{ marginLeft: 'auto' }}>{filters}</span>
              </div>
              {historyProblem}
              {historyList}
            </section>
          </div>
        </>
      )}

      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => submit(confirm)} danger={false}
        title={confirm === 'schedule' ? t('communication.confirmScheduleTitle') : t('communication.confirmSendTitle')}
        message={confirmText || ''} confirmLabel={confirm === 'schedule' ? t('communication.schedule') : t('communication.send')} />
      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => { doDelete(deleteId); setDeleteId(null); }}
        title={t('communication.deleteTitle')} message={t('communication.deleteMessage')} confirmLabel={t('common.delete')} danger />
      <AudienceList open={showPeople} onClose={() => setShowPeople(false)} audience={d.audience} channel={d.channel} t={t}
        onChange={(audience) => set({ audience })} />
      <MessageDetails id={viewId} onClose={() => setViewId(null)} audienceText={audienceText} statusPill={statusPill} onRetry={doRetry} t={t} isMobile={isMobile} />
    </div>
  );
}

// One message: what was said, to whom, and how each delivery went
function MessageDetails({ id, onClose, audienceText, statusPill, onRetry, t, isMobile }) {
  const [c, setC] = useState(null);
  const [tab, setTab] = useState('all');
  const liveTick = useLiveTick(['communications']);
  useEffect(() => { if (!id) { setC(null); setTab('all'); return; } getOne(id).then(r => setC(r.data)).catch(() => setC(null)); }, [id, liveTick]);
  useEffect(() => {
    if (!id || c?.status !== 'sending') return undefined;
    const timer = setInterval(() => getOne(id).then(r => setC(r.data)).catch(() => {}), 2000);
    return () => clearInterval(timer);
  }, [id, c?.status]);
  const rows = (c?.deliveries || []).filter(r => tab === 'all' || (tab === 'sent' ? r.status === 'sent' : tab === 'failed' ? r.status === 'failed' : r.status === 'skipped'));
  const n = (s) => (c?.deliveries || []).filter(r => r.status === s).length;
  const tile = (value, text, color) => (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{text}</div>
    </div>
  );
  return (
    <Modal open={!!id} onClose={onClose} title={t('communication.details')} maxWidth={720}>
      {!c ? <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>{t('common.loading')}</div> : (
        <div data-message-details style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'DM Sans' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>{c.channel === 'sms' ? t('communication.textMessage') : (c.subject || t('communication.untitled'))}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                {t(`communication.ch_${c.channel || 'email'}`)} · {audienceText(c)} · {c.sentBy ? `${c.sentBy.firstName} ${c.sentBy.lastName}` : ''}
              </div>
            </div>
            {statusPill(c)}
          </div>
          {c.testMode && <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '9px 12px', display: 'flex', gap: 8 }}><Info size={14} color="var(--accent-gold)" style={{ flexShrink: 0, marginTop: 1 }} />{t('communication.sentInTestMode')}</div>}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.body}</div>
          {c.status !== 'draft' && c.status !== 'scheduled' && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 4}, 1fr)`, gap: 8 }}>
              {tile(c.emailSent || 0, t('communication.tileEmails'), 'var(--accent-blue)')}
              {tile(c.smsSent || 0, t('communication.tileTexts'), 'var(--accent-gold)')}
              {tile((c.emailFailed || 0) + (c.smsFailed || 0), t('communication.tileFailed'), 'var(--accent-red)')}
              {tile(c.skipped || 0, t('communication.tileNoContact'), 'var(--text-secondary)')}
            </div>
          )}
          {(c.deliveries || []).length > 0 && (
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
                {['all', 'sent', 'failed', 'skipped'].map(k => (
                  <button key={k} type="button" data-delivery-filter={k} onClick={() => setTab(k)} style={{ ...chip(tab === k), padding: '4px 10px', fontSize: 12 }}>
                    {t(`communication.d_${k}`)} {k === 'all' ? (c.deliveries || []).length : n(k)}
                  </button>
                ))}
                {n('failed') > 0 && c.status !== 'sending' && (
                  <button type="button" data-retry onClick={() => onRetry(c.id)} style={{ ...plainBtn, marginLeft: 'auto', padding: '6px 12px', fontSize: 12.5 }}><RefreshCw size={13} /> {t('communication.retryFailed')}</button>
                )}
              </div>
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, maxHeight: 300, overflowY: 'auto' }}>
                {rows.map(r => (
                  <div key={r.id} data-delivery={r.status} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12.5 }}>
                    {r.channel === 'sms' ? <MessageSquare size={13} color="var(--text-muted)" /> : <Mail size={13} color="var(--text-muted)" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.address || ''}{r.error ? `${r.address ? ' · ' : ''}${r.error}` : ''}</div>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: r.status === 'sent' ? 'var(--accent-green)' : r.status === 'failed' ? 'var(--accent-red)' : 'var(--text-muted)' }}>{t(`communication.d_${r.status}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" style={plainBtn} onClick={onClose}>{t('common.close')}</button></div>
        </div>
      )}
    </Modal>
  );
}

// Everyone a group reaches. Unticking someone leaves them out of this message
// (audience.excludeIds); the group itself is unchanged.
function AudienceList({ open, onClose, audience, onChange, channel, t }) {
  const [people, setPeople] = useState(null);
  const [q, setQ] = useState('');
  const { excludeIds = [], ...group } = audience;
  const groupKey = JSON.stringify(group);
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setPeople(null); setQ('');
    previewAudience(group, { list: true }).then(r => { if (alive) setPeople(r.data?.people || []); }).catch(() => { if (alive) setPeople([]); });
    return () => { alive = false; };
  }, [open, groupKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const out = new Set(excludeIds);
  const toggle = (id) => {
    const next = new Set(out);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange({ ...group, ...(next.size ? { excludeIds: [...next] } : {}) });
  };
  const query = q.trim().toLowerCase();
  const shown = (people || []).filter(p => !query || p.name.toLowerCase().includes(query) || String(p.memberCode).toLowerCase().includes(query));
  const total = (people || []).length, included = (people || []).filter(p => !out.has(p.id)).length;
  const needEmail = channel === 'email' || channel === 'both', needPhone = channel === 'sms' || channel === 'both';
  return (
    <Modal open={open} onClose={onClose} title={t('communication.whoGetsIt')} maxWidth={520}>
      <div data-people-list style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'DM Sans' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span data-people-count style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600 }}>{people ? t('communication.includedOf', { n: included, total }) : t('common.loading')}</span>
          {out.size > 0 && (
            <button type="button" data-include-all onClick={() => onChange(group)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--accent-gold)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans' }}>
              {t('communication.putEveryoneBack')}
            </button>
          )}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('communication.findPeople')} aria-label={t('communication.findPeople')}
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, color: 'var(--text-primary)', fontFamily: 'DM Sans', outline: 'none' }} />
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, maxHeight: 360, overflowY: 'auto' }}>
          {people && shown.length === 0 && <div style={{ padding: '20px 14px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>{t('communication.nothingHere')}</div>}
          {shown.map(p => {
            const on = !out.has(p.id);
            const unreachable = (needEmail && !p.email && (!needPhone || !p.phone)) || (needPhone && !p.phone && (!needEmail || !p.email));
            return (
              <label key={p.id} data-person={p.id} data-included={on ? '1' : '0'}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', opacity: on ? 1 : 0.5 }}>
                <input type="checkbox" checked={on} onChange={() => toggle(p.id)} style={{ width: 16, height: 16, accentColor: '#c9a96e', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', textDecoration: on ? 'none' : 'line-through' }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{p.memberCode}{unreachable ? ` · ${t('communication.cantBeReached')}` : ''}</div>
                </div>
                <span style={{ display: 'inline-flex', gap: 8, color: 'var(--text-muted)' }}>
                  <Mail size={13} style={{ opacity: p.email ? 1 : 0.25 }} aria-label={p.email ? t('communication.hasEmail') : t('memberProfile.msgNoEmail')} />
                  <MessageSquare size={13} style={{ opacity: p.phone ? 1 : 0.25 }} aria-label={p.phone ? t('communication.hasPhone') : t('memberProfile.msgNoPhone')} />
                </span>
              </label>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" data-people-done onClick={onClose} style={{ ...goldBtn, padding: '10px 22px' }}>{t('common.done')}</button>
        </div>
      </div>
    </Modal>
  );
}

