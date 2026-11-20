import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone, Send } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import GemInput from '../../components/ui/GemInput';
import ConfirmModal from '../../components/ui/ConfirmModal';
import LoadFailed from '../../components/ui/LoadFailed';
import { getAnnouncements, createAnnouncement, getGyms, getGym } from '../../services/admin.service';
import { PageTitle, Empty, Pill, Problem, Chips } from './adminUi';
import { card, goldBtn, plainBtn, sectionLabel, field, day, nt, refusal } from './adminFormat';

// A message from GEM to every gym, or to one: a notification in GEM for each,
// and an email to the owners when asked
export default function AdminAnnouncements() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [params] = useSearchParams();
  const [list, setList] = useState(null);
  const [gymCount, setGymCount] = useState(0);
  // The one gym it goes to, found by searching ({ id, name }); none: every gym
  const [chosen, setChosen] = useState(null);
  const [toOne, setToOne] = useState(() => !!params.get('gym'));
  const [failed, setFailed] = useState(false);
  const [f, setF] = useState({ title: '', body: '', email: true });
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => { getAnnouncements().then(r => { setList(r.data); setFailed(false); }).catch(() => setFailed(true)); }, []);
  useEffect(() => {
    load();
    getGyms({ limit: 1 }).then(r => setGymCount(r.data.counts.all)).catch(() => {});
    const asked = params.get('gym');
    if (asked) getGym(asked).then(r => setChosen({ id: r.data.id, name: r.data.name })).catch(() => {});
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => { const v = k === 'email' ? e.target.checked : e.target.value; setF(x => ({ ...x, [k]: v })); setErrors(x => ({ ...x, [k]: undefined, _form: undefined })); setNotice(''); };
  const ask = () => {
    const e = {};
    if (toOne && !chosen) e.gymId = t('admin.chooseGym');
    if (!f.title.trim()) e.title = t('admin.titleNeeded');
    if (!f.body.trim()) e.body = t('admin.bodyNeeded');
    setErrors(e);
    if (!Object.keys(e).length) setConfirming(true);
  };
  const send = async () => {
    setConfirming(false); setBusy(true);
    try {
      const r = await createAnnouncement({ title: f.title.trim(), body: f.body.trim(), gymId: toOne ? chosen?.id : undefined, email: f.email });
      setNotice(nt(t, 'admin.announcementSent', { n: r.data.gyms }));
      setF(x => ({ ...x, title: '', body: '' }));
      load();
    } catch (err) {
      const field = err?.response?.data?.field;
      setErrors(field ? { [field]: refusal(err, t('admin.saveFailed')) } : { _form: refusal(err, t('admin.saveFailed')) });
    }
    setBusy(false);
  };
  const gymName = toOne ? chosen?.name : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageTitle title={t('admin.navAnnouncements')} subtitle={t('admin.announcementsSub')} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <section style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }} aria-labelledby="compose-announcement">
          <div id="compose-announcement" style={sectionLabel}>{t('admin.newAnnouncement')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'DM Sans, sans-serif' }}>{t('admin.sendTo')}</span>
            <Chips label={t('admin.sendTo')} value={toOne ? 'one' : 'all'} onChange={(k) => { setToOne(k === 'one'); setErrors(x => ({ ...x, gymId: undefined })); }}
              items={[['all', t('admin.allGyms')], ['one', t('admin.oneGym')]]} />
            {toOne && (chosen ? (
              <div data-chosen-gym style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-elevated)', borderRadius: 10, padding: '9px 12px', fontSize: 13.5, color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif' }}>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{chosen.name}</span>
                <button type="button" style={{ ...plainBtn, padding: '5px 10px', fontSize: 12 }} onClick={() => setChosen(null)}>{t('admin.change')}</button>
              </div>
            ) : <GymSearch t={t} onPick={(g) => { setChosen(g); setErrors(x => ({ ...x, gymId: undefined })); }} />)}
            {errors.gymId && <span role="alert" data-field-error style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans, sans-serif' }}>{errors.gymId}</span>}
          </div>
          <GemInput label={t('admin.announcementTitle')} required maxLength={120} value={f.title} onChange={set('title')} error={errors.title} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="announcement-body" style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'DM Sans, sans-serif' }}>{t('admin.announcementBody')} *</label>
            <textarea id="announcement-body" value={f.body} onChange={set('body')} rows={6} maxLength={4000} style={{ ...field, resize: 'vertical', borderColor: errors.body ? 'var(--accent-red)' : 'var(--border-subtle)' }} />
            {errors.body && <span role="alert" data-field-error style={{ fontSize: 12, color: 'var(--accent-red)', fontFamily: 'DM Sans, sans-serif' }}>{errors.body}</span>}
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            <input type="checkbox" data-email-owners checked={f.email} onChange={set('email')} style={{ accentColor: '#c9a96e', width: 16, height: 16 }} />
            {t('admin.alsoEmail')}
          </label>
          <Problem>{errors._form}</Problem>
          {notice && <div role="status" data-notice style={{ fontSize: 13, color: 'var(--accent-green)', fontFamily: 'DM Sans, sans-serif' }}>{notice}</div>}
          <button type="button" data-send-announcement style={{ ...goldBtn, alignSelf: isMobile ? 'stretch' : 'flex-start', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={ask}><Send size={15} /> {t('admin.send')}</button>
        </section>

        <section style={{ ...card, padding: 18 }} aria-labelledby="announcement-history">
          <div id="announcement-history" style={{ ...sectionLabel, marginBottom: 8 }}>{t('admin.sentBefore')}</div>
          {failed && !list ? <LoadFailed message={t('admin.loadFailed')} onRetry={load} /> : !list ? null : list.length === 0 ? <Empty icon={Megaphone} title={t('admin.noAnnouncements')} /> : list.map((a, i) => (
            <div key={a.id} data-announcement style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none', fontFamily: 'DM Sans, sans-serif' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{a.title}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{day(a.createdAt)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '3px 0 6px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{a.body}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Pill tone="gold">{a.gymName || nt(t, 'admin.toNGyms', { n: a.gyms })}</Pill>
                {a.emailed && <Pill tone="blue">{t('admin.emailed')}</Pill>}
              </div>
            </div>
          ))}
        </section>
      </div>
      <ConfirmModal open={confirming} danger={false} onClose={() => setConfirming(false)} onConfirm={send}
        title={t('admin.confirmAnnouncement')} message={gymName ? t('admin.confirmToGym', { gym: gymName }) : nt(t, 'admin.confirmToAll', { n: gymCount })} confirmLabel={t('admin.send')} />
    </div>
  );
}

// Finding the one gym a message goes to, by name or code
function GymSearch({ t, onPick }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  useEffect(() => {
    const term = q.trim();
    let alive = true;
    const timer = setTimeout(() => {
      if (!term) { setFound([]); return; }
      getGyms({ q: term, limit: 8 }).then(r => { if (alive) setFound(r.data.gyms); }).catch(() => {});
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [q]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('admin.findGym')} aria-label={t('admin.findGym')} style={field} />
      {found.length > 0 && (
        <div role="listbox" aria-label={t('admin.findGym')} style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
          {found.map(g => (
            <button key={g.id} type="button" role="option" aria-selected="false" data-gym-option={g.code} onClick={() => onPick({ id: g.id, name: g.name })}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 12px', background: 'var(--bg-card)', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text-primary)' }}>
              <span style={{ fontWeight: 600 }}>{g.name}</span><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{g.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
