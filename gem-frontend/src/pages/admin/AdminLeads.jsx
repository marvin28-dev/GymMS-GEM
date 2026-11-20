import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Plus, Search, Mail, Phone, Pencil } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import Modal from '../../components/ui/Modal';
import RowMenu from '../../components/ui/RowMenu';
import GemInput from '../../components/ui/GemInput';
import GemSelect from '../../components/ui/GemSelect';
import LoadFailed from '../../components/ui/LoadFailed';
import { SkeletonCards } from '../../components/Skeleton';
import { getLeads, createLead, updateLead } from '../../services/admin.service';
import { digitsOnly } from '../../utils/number';
import { todayStr, dayStr } from '../../utils/date';
import { PageTitle, Empty, Chips, Pill, Problem } from './adminUi';
import { card, th, td, goldBtn, plainBtn, field, day, refusal } from './adminFormat';

const STAGES = ['new', 'contacted', 'demo', 'won', 'lost'];
const STAGE_TONE = { new: 'amber', contacted: 'blue', demo: 'purple', won: 'green', lost: 'grey' };
const followUpDue = (l) => l.nextFollowUp && !['won', 'lost'].includes(l.status) && dayStr(l.nextFollowUp) <= todayStr();

// Gyms that might use GEM: from the landing page's "Book a demo", or added by hand
export default function AdminLeads() {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [leads, setLeads] = useState(null);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState('open');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => { getLeads().then(r => { setLeads(r.data); setFailed(false); }).catch(() => setFailed(true)); }, []);
  useEffect(() => { load(); }, [load]);

  const FILTERS = {
    open: (l) => !['won', 'lost'].includes(l.status),
    due: followUpDue,
    ...Object.fromEntries(STAGES.map(s => [s, (l) => l.status === s])),
    all: () => true,
  };
  const query = q.trim().toLowerCase();
  const list = (leads || []).filter(FILTERS[stage]).filter(l => !query || [l.name, l.gymName, l.email, l.phone, l.city].some(v => String(v || '').toLowerCase().includes(query)));
  const count = (k) => (leads || []).filter(FILTERS[k]).length;
  const menu = (l) => [
    { label: t('admin.editLead'), icon: <Pencil size={15} />, onClick: () => setEditing(l) },
    { label: t('admin.openGym'), onClick: () => navigate(`/admin/gyms/${l.gym.id}`), hidden: !l.gym },
  ];
  const contact = (l) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12.5 }}>
      {l.email && <a href={`mailto:${l.email}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Mail size={12} />{l.email}</a>}
      {l.phone && <a href={`tel:${String(l.phone).replace(/[^\d+]/g, '')}`} style={{ color: 'var(--accent-blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Phone size={12} />{l.phone}</a>}
    </div>
  );
  const followCell = (l) => (l.nextFollowUp && !['won', 'lost'].includes(l.status)
    ? <span style={{ color: followUpDue(l) ? 'var(--accent-red)' : 'var(--text-secondary)', fontWeight: followUpDue(l) ? 700 : 400 }}>{day(l.nextFollowUp)}</span>
    : <span style={{ color: 'var(--text-muted)' }}>-</span>);

  if (failed && !leads) return <><PageTitle title={t('admin.navLeads')} /><LoadFailed message={t('admin.loadFailed')} onRetry={load} /></>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageTitle title={t('admin.navLeads')} subtitle={t('admin.leadsSub')}>
        <button type="button" data-add-lead style={goldBtn} onClick={() => setEditing({})}><Plus size={15} /> {t('admin.addLead')}</button>
      </PageTitle>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '0 1 280px' }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('admin.searchLeads')} aria-label={t('admin.searchLeads')}
            style={{ ...field, background: 'var(--bg-card)', paddingLeft: 34, fontSize: isMobile ? 16 : 13.5 }} />
        </div>
        <Chips label={t('admin.filter')} value={stage} onChange={setStage} items={Object.keys(FILTERS).map(k => [k, t(`admin.lead_${k}`), leads ? count(k) : undefined])} />
      </div>

      {!leads ? <SkeletonCards count={3} /> : list.length === 0 ? (
        <div style={card}><Empty icon={Target} title={leads.length ? t('admin.noLeadsMatch') : t('admin.noLeads')} hint={leads.length ? '' : t('admin.noLeadsHint')} /></div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(l => (
            <div key={l.id} data-lead-row={l.status} style={{ ...card, padding: '12px 14px', display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => setEditing(l)}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{l.gymName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 6px' }}>{l.name}{l.city ? ` · ${l.city}` : ''} · {day(l.createdAt)}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Pill tone={STAGE_TONE[l.status]}>{t(`admin.lead_${l.status}`)}</Pill>
                  {followUpDue(l) && <span style={{ fontSize: 12, color: 'var(--accent-red)', fontWeight: 700 }}>{t('admin.followUpDue')}</span>}
                </div>
              </div>
              <RowMenu title={t('common.actions')} items={menu(l)} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{[t('admin.colGym'), t('admin.colContact'), t('admin.members'), t('admin.colStage'), t('admin.colFollowUp'), t('admin.colAdded'), ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map(l => (
                <tr key={l.id} data-lead-row={l.status} style={{ cursor: 'pointer' }} onClick={() => setEditing(l)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <td style={td}><div style={{ fontWeight: 600 }}>{l.gymName}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.name}{l.city ? ` · ${l.city}` : ''}{l.source === 'website' ? ` · ${t('admin.fromWebsite')}` : ''}</div></td>
                  <td style={td} onClick={e => e.stopPropagation()}>{contact(l)}</td>
                  <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{l.members ?? '-'}</td>
                  <td style={td}><Pill tone={STAGE_TONE[l.status]}>{t(`admin.lead_${l.status}`)}</Pill></td>
                  <td style={td}>{followCell(l)}</td>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>{day(l.createdAt)}</td>
                  <td style={{ ...td, width: 44 }} onClick={e => e.stopPropagation()}><RowMenu title={t('common.actions')} items={menu(l)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <LeadModal lead={editing} t={t} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

// A lead's details, stage, notes and next follow-up; also adds one by hand
function LeadModal({ lead, t, onClose, onSaved }) {
  const isNew = !lead.id;
  const [f, setF] = useState(() => ({
    name: lead.name || '', gymName: lead.gymName || '', email: lead.email || '', phone: lead.phone || '', city: lead.city || '', country: lead.country || '',
    members: lead.members != null ? String(lead.members) : '', status: lead.status || 'new', notes: lead.notes || '', nextFollowUp: lead.nextFollowUp ? dayStr(lead.nextFollowUp) : '',
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF(x => ({ ...x, [k]: k === 'members' ? digitsOnly(e.target.value) : e.target.value })); setErrors(x => ({ ...x, [k]: undefined, _form: undefined })); };
  const save = async () => {
    setBusy(true);
    const data = { ...f, members: f.members === '' ? null : Number(f.members), nextFollowUp: f.nextFollowUp || null };
    try {
      if (isNew) await createLead(data); else await updateLead(lead.id, data);
      onSaved(); onClose();
    } catch (e) {
      const field = e?.response?.data?.field;
      setErrors(field ? { [field]: refusal(e, t('admin.saveFailed')) } : { _form: refusal(e, t('admin.saveFailed')) });
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={isNew ? t('admin.addLead') : lead.gymName} maxWidth={560}>
      <div data-lead-form style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lead.message && (
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontFamily: 'DM Sans, sans-serif' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('admin.theirMessage', { date: day(lead.createdAt) })}</div>{lead.message}
          </div>
        )}
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <GemInput label={t('admin.leadGymName')} required value={f.gymName} onChange={set('gymName')} error={errors.gymName} />
          <GemInput label={t('admin.leadName')} required value={f.name} onChange={set('name')} error={errors.name} />
          <GemInput label={t('admin.email')} type="email" value={f.email} onChange={set('email')} error={errors.email} />
          <GemInput label={t('admin.phone')} inputMode="tel" value={f.phone} onChange={set('phone')} error={errors.phone} />
          <GemInput label={t('admin.city')} value={f.city} onChange={set('city')} error={errors.city} />
          <GemInput label={t('admin.country')} value={f.country} onChange={set('country')} error={errors.country} />
          <GemInput label={t('admin.leadMembers')} inputMode="numeric" value={f.members} onChange={set('members')} error={errors.members} />
          <GemSelect label={t('admin.colStage')} value={f.status} onChange={set('status')} options={STAGES.map(s => ({ value: s, label: t(`admin.lead_${s}`) }))} />
        </div>
        <GemInput label={t('admin.colFollowUp')} type="date" value={f.nextFollowUp} onChange={set('nextFollowUp')} error={errors.nextFollowUp} />
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'DM Sans, sans-serif' }} htmlFor="lead-notes">{t('admin.leadNotes')}</label>
        <textarea id="lead-notes" value={f.notes} onChange={set('notes')} rows={4} maxLength={4000} style={{ ...field, resize: 'vertical' }} />
        {lead.gym && <div style={{ fontSize: 12.5, color: 'var(--accent-green)', fontFamily: 'DM Sans, sans-serif' }}>{t('admin.becameGym', { gym: lead.gym.name })}</div>}
        <Problem>{errors._form}</Problem>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" style={plainBtn} onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" data-lead-save style={{ ...goldBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={save}>{isNew ? t('admin.addLead') : t('common.save')}</button>
        </div>
      </div>
    </Modal>
  );
}

