import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Lock, Unlock, Megaphone, Receipt, LifeBuoy } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import RowMenu from '../../components/ui/RowMenu';
import LoadFailed from '../../components/ui/LoadFailed';
import { SkeletonCards } from '../../components/Skeleton';
import { getGym, updateGym, unlockGym } from '../../services/admin.service';
import { digitsOnly } from '../../utils/number';
import { dayStr } from '../../utils/date';
import { Stat, Empty, Pill, GymPill, BillPill, Problem } from './adminUi';
import { card, th, td, goldBtn, plainBtn, dangerBtn, sectionLabel, field, money, day, monthLabel, nt, lastSeen, refusal, billMenu } from './adminFormat';
import { useBillDialogs } from './useBillDialogs';

// One gym, all GEM keeps about it
export default function AdminGymDetail() {
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [g, setG] = useState(null);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState('');

  const load = useCallback(() => { getGym(id).then(r => { setG(r.data); setFailed(false); }).catch(() => setFailed(true)); }, [id]);
  useEffect(() => { load(); }, [load]);
  const bills = useBillDialogs({ t, lang, onChanged: load, isLocked: () => !!g?.locked });

  const back = <button type="button" onClick={() => navigate('/admin/gyms')} style={{ ...plainBtn, alignSelf: 'flex-start', padding: '7px 12px' }}><ArrowLeft size={15} /> {t('admin.navGyms')}</button>;
  if (failed && !g) return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{back}<LoadFailed message={t('admin.loadFailed')} onRetry={load} /></div>;
  if (!g) return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{back}<SkeletonCards count={3} /></div>;

  const reopen = async () => {
    setProblem('');
    try { await unlockGym(g.id); load(); } catch (e) { setProblem(refusal(e, t('admin.saveFailed'))); }
  };
  const grid = { display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 10 };
  const invoices = g.invoices.map(i => ({ ...i, gym: { id: g.id, name: g.name, code: g.code, lockedAt: g.locked?.at || null } }));

  return (
    <div data-admin-gym={g.code} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {back}

      {/* Who and where, and where it stands */}
      <section style={{ ...card, padding: 18, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14, alignItems: isMobile ? 'stretch' : 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{g.name}</h1>
            <GymPill g={g} t={t} />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'DM Sans, sans-serif' }}>
            {[g.code, [g.location, g.city, g.country].filter(Boolean).join(', '), t('admin.joined', { date: day(g.createdAt) })].filter(Boolean).join(' · ')}
          </div>
          {g.owner && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center', fontFamily: 'DM Sans, sans-serif' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{g.owner.name}</span>
              {g.owner.email && <a href={`mailto:${g.owner.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--accent-blue)', textDecoration: 'none' }}><Mail size={13} />{g.owner.email}</a>}
              {g.owner.phone && <a href={`tel:${String(g.owner.phone).replace(/[^\d+]/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--accent-blue)', textDecoration: 'none' }}><Phone size={13} />{g.owner.phone}</a>}
            </div>
          )}
          {g.locked && <div data-paused-reason style={{ marginTop: 12, fontSize: 13, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', borderRadius: 10, padding: '9px 12px', fontFamily: 'DM Sans, sans-serif' }}>{t('admin.pausedSince', { date: day(g.locked.at), reason: g.locked.reason || '' })}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={plainBtn} onClick={() => navigate(`/admin/announcements?gym=${g.id}`)}><Megaphone size={15} /> {t('admin.writeToGym')}</button>
          {g.locked
            ? <button type="button" data-reopen-gym style={goldBtn} onClick={reopen}><Unlock size={15} /> {t('admin.reopenAccount')}</button>
            : <button type="button" data-pause-gym style={dangerBtn} onClick={() => bills.open('lock', { gymId: g.id, gym: { name: g.name } })}><Lock size={15} /> {t('admin.pauseAccount')}</button>}
        </div>
      </section>
      <Problem>{problem || bills.problem}</Problem>

      <div style={grid}>
        <Stat label={t('admin.statMembers')} value={g.members.billable} sub={t('admin.membersDetail', { total: g.members.total, visitors: g.visitors })} />
        <Stat label={t('admin.staff')} value={g.staff} sub={Object.entries(g.staffByRole).map(([r, n]) => `${n} ${t(`admin.role_${r}`)}`).join(', ') || '-'} />
        <Stat label={t('admin.checkIns30')} value={g.last30.checkIns} sub={nt(t, 'admin.payments30', { n: g.last30.payments })} />
        <Stat label={t('admin.colLastActive')} value={lastSeen(g, t)} sub={g.setupDone ? t('admin.setupDone') : t('admin.setupNotDone')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <PlanCard g={g} t={t} onSaved={load} />
        <NoteCard g={g} t={t} onSaved={load} />
      </div>

      {/* Its bills */}
      <section style={{ ...card, padding: isMobile ? 14 : 0 }} aria-labelledby="gym-bills">
        <div id="gym-bills" style={{ ...sectionLabel, padding: isMobile ? '0 0 10px' : '16px 18px 0' }}>{t('admin.bills')}</div>
        {invoices.length === 0 ? <Empty icon={Receipt} title={t('admin.noBillsForGym')} /> : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {invoices.map((inv, i) => (
              <div key={inv.id} data-bill-row={inv.period} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}><span>{monthLabel(inv.period, lang)}</span><span>{money(inv.amount, inv.currency)}</span></div>
                  <div style={{ marginTop: 6 }}><BillPill inv={inv} t={t} /></div>
                </div>
                <RowMenu title={t('common.actions')} items={billMenu(inv, t, bills.open)} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{[t('admin.colMonth'), t('admin.members'), t('admin.amount'), t('admin.colStatus'), ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} data-bill-row={inv.period}>
                    <td style={td}>{monthLabel(inv.period, lang)}</td>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{inv.members}</td>
                    <td style={{ ...td, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(inv.amount, inv.currency)}</td>
                    <td style={td}><BillPill inv={inv} t={t} /></td>
                    <td style={{ ...td, width: 44 }}><RowMenu title={t('common.actions')} items={billMenu(inv, t, bills.open)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* What it has told GEM */}
      <section style={{ ...card, padding: 18 }} aria-labelledby="gym-reports">
        <div id="gym-reports" style={{ ...sectionLabel, marginBottom: 8 }}>{t('admin.recentReports')}</div>
        {g.reports.length === 0 ? <Empty icon={LifeBuoy} title={t('admin.noReportsFromGym')} /> : g.reports.map((r, i) => (
          <button key={r.id} type="button" onClick={() => navigate(`/admin/problems?open=${r.id}`)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', background: 'none', border: 'none', borderTop: i ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{day(r.createdAt)}</span>
            <Pill tone={r.status === 'resolved' ? 'green' : r.status === 'in_progress' ? 'blue' : 'amber'}>{t(`admin.report_${r.status}`)}</Pill>
          </button>
        ))}
      </section>
      {bills.dialogs}
    </div>
  );
}

// What the gym pays: its own price or GEM's, and when its trial ends
function PlanCard({ g, t, onSaved }) {
  const [rate, setRate] = useState(g.customRate ? String(g.rate) : '');
  const [trial, setTrial] = useState(dayStr(g.trialEndsAt));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(['', false]);
  const save = async (data) => {
    setBusy(true); setMsg(['', false]);
    try { await updateGym(g.id, data); setMsg([t('admin.saved'), true]); onSaved(); } catch (e) { setMsg([refusal(e, t('admin.saveFailed')), false]); }
    setBusy(false);
  };
  return (
    <section style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }} aria-labelledby="gym-plan" data-plan-card>
      <div id="gym-plan" style={sectionLabel}>{t('admin.plan')}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
        {t('admin.planLine', { rate: money(g.rate, g.currency), estimate: money(g.monthlyEstimate, g.currency) })}
        {g.owes.outstanding > 0 && <div style={{ color: g.owes.overdue ? 'var(--accent-red)' : 'var(--text-secondary)' }}>{t('admin.owesLine', { amount: money(g.owes.outstanding, g.currency) })}</div>}
      </div>
      <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'DM Sans, sans-serif' }} htmlFor="plan-rate">{t('admin.ownPrice')}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id="plan-rate" inputMode="numeric" value={rate} placeholder={t('admin.standardPrice')} onChange={e => setRate(digitsOnly(e.target.value))} style={{ ...field, flex: 1 }} />
        <button type="button" data-save-rate style={{ ...plainBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => save({ billingRate: rate === '' ? null : Number(rate) })}>{t('common.save')}</button>
      </div>
      <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'DM Sans, sans-serif' }} htmlFor="plan-trial">{t('admin.trialEnds')}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input id="plan-trial" type="date" value={trial} onChange={e => setTrial(e.target.value)} style={{ ...field, flex: 1 }} />
        <button type="button" data-save-trial style={{ ...plainBtn, opacity: busy ? 0.6 : 1 }} disabled={busy || !trial} onClick={() => save({ trialEndsAt: trial })}>{t('common.save')}</button>
      </div>
      {msg[0] && <div role={msg[1] ? 'status' : 'alert'} style={{ fontSize: 12.5, color: msg[1] ? 'var(--accent-green)' : 'var(--accent-red)', fontFamily: 'DM Sans, sans-serif' }}>{msg[0]}</div>}
    </section>
  );
}

// GEM's own note about the gym; the gym never sees it
function NoteCard({ g, t, onSaved }) {
  const [note, setNote] = useState(g.adminNote || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(['', false]);
  const save = async () => {
    setBusy(true); setMsg(['', false]);
    try { await updateGym(g.id, { adminNote: note }); setMsg([t('admin.saved'), true]); onSaved(); } catch (e) { setMsg([refusal(e, t('admin.saveFailed')), false]); }
    setBusy(false);
  };
  return (
    <section style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }} aria-labelledby="gym-note">
      <div id="gym-note" style={sectionLabel}>{t('admin.privateNote')}</div>
      <textarea aria-labelledby="gym-note" value={note} onChange={e => setNote(e.target.value)} rows={5} maxLength={4000} placeholder={t('admin.privateNotePh')} style={{ ...field, resize: 'vertical' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" data-save-note style={{ ...plainBtn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={save}>{t('common.save')}</button>
        {msg[0] && <span role={msg[1] ? 'status' : 'alert'} style={{ fontSize: 12.5, color: msg[1] ? 'var(--accent-green)' : 'var(--accent-red)', fontFamily: 'DM Sans, sans-serif' }}>{msg[0]}</span>}
      </div>
    </section>
  );
}
