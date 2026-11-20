import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Lock, Moon, LifeBuoy, Target, Receipt, ChevronRight, Building2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import LoadFailed from '../../components/ui/LoadFailed';
import { SkeletonCards } from '../../components/Skeleton';
import { getOverview } from '../../services/admin.service';
import { Stat, PageTitle, Empty } from './adminUi';
import { card, sectionLabel, money, day, monthLabel, nt } from './adminFormat';

// The first screen: how GEM is doing, and what needs the admin today
export default function AdminOverview() {
  const { t, lang } = useLanguage();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [o, setO] = useState(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    getOverview().then(r => { setO(r.data); setFailed(false); }).catch(() => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (failed && !o) return <><PageTitle title={t('admin.navOverview')} /><LoadFailed message={t('admin.loadFailed')} onRetry={load} /></>;
  if (!o) return <><PageTitle title={t('admin.navOverview')} /><SkeletonCards count={4} /></>;

  const cur = o.currency;
  const grid = { display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: 10 };

  const ATTENTION = {
    overdue: [AlertTriangle, 'red', (a) => nt(t, a.locked ? 'admin.attOverduePaused' : 'admin.attOverdue', { gym: a.gymName, amount: money(a.amount, cur), n: a.days }), (a) => `/admin/gyms/${a.gymId}`],
    trial_ending: [Clock, 'amber', (a) => nt(t, 'admin.attTrialEnding', { gym: a.gymName, n: a.days }), (a) => `/admin/gyms/${a.gymId}`],
    locked: [Lock, 'red', (a) => t('admin.attLocked', { gym: a.gymName }), (a) => `/admin/gyms/${a.gymId}`],
    inactive: [Moon, 'grey', (a) => (a.days == null ? t('admin.attNeverUsed', { gym: a.gymName }) : t('admin.attInactive', { gym: a.gymName, n: a.days })), (a) => `/admin/gyms/${a.gymId}`],
    problems: [LifeBuoy, 'amber', (a) => nt(t, 'admin.attProblems', { n: a.count }), () => '/admin/problems'],
    followups: [Target, 'blue', (a) => nt(t, 'admin.attFollowUps', { n: a.count }), () => '/admin/leads'],
    drafts: [Receipt, 'gold', (a) => nt(t, 'admin.attDrafts', { n: a.count }), () => '/admin/billing'],
  };
  const toneColor = { red: 'var(--accent-red)', amber: 'var(--accent-yellow)', grey: 'var(--text-muted)', blue: 'var(--accent-blue)', gold: 'var(--accent-gold)' };

  const top = Math.max(1, ...o.monthly.flatMap(m => [m.billed, m.paid]));

  return (
    <div data-admin-overview style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <PageTitle title={t('admin.navOverview')} subtitle={t('admin.overviewSub')} />

      <div style={grid}>
        <Stat label={t('admin.statGyms')} value={o.gyms.total} sub={t('admin.statGymsSub', { n: o.gyms.active })} onClick={() => navigate('/admin/gyms')} data-stat="gyms" />
        <Stat label={t('admin.statTrial')} value={o.gyms.onTrial} sub={t('admin.statTrialSub', { n: o.gyms.trialsEnding })} tone={o.gyms.trialsEnding ? 'amber' : undefined} onClick={() => navigate('/admin/gyms?filter=trial')} data-stat="trial" />
        <Stat label={t('admin.statMembers')} value={o.members.billable} sub={t('admin.statMembersSub', { n: o.members.total })} data-stat="members" />
        <Stat label={t('admin.statEstimate')} value={money(o.money.monthlyEstimate, cur)} sub={t('admin.statEstimateSub')} data-stat="estimate" />
        <Stat label={t('admin.statCollected')} value={money(o.money.collectedThisMonth, cur)} sub={t('admin.statCollectedSub')} tone="green" onClick={() => navigate('/admin/billing')} data-stat="collected" />
        <Stat label={t('admin.statOutstanding')} value={money(o.money.outstanding, cur)} sub={o.money.overdue ? t('admin.statOverdueSub', { amount: money(o.money.overdue, cur) }) : t('admin.statNothingOverdue')} tone={o.money.overdue ? 'red' : undefined} onClick={() => navigate('/admin/billing')} data-stat="outstanding" />
        <Stat label={t('admin.statProblems')} value={o.support.new} sub={t('admin.statProblemsSub', { n: o.support.inProgress })} tone={o.support.new ? 'amber' : undefined} onClick={() => navigate('/admin/problems')} data-stat="problems" />
        <Stat label={t('admin.statLeads')} value={o.leads.open} sub={t('admin.statLeadsSub', { n: o.leads.followUps })} onClick={() => navigate('/admin/leads')} data-stat="leads" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 3fr) minmax(0, 2fr)', gap: 14, alignItems: 'start' }}>
        <section style={{ ...card, padding: 18 }} aria-labelledby="admin-attention">
          <div id="admin-attention" style={{ ...sectionLabel, marginBottom: 10 }}>{t('admin.attention')}</div>
          {o.attention.length === 0 ? <Empty title={t('admin.allClear')} hint={t('admin.allClearHint')} /> : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {o.attention.map((a, i) => {
                const [Icon, tone, text, link] = ATTENTION[a.type] || [AlertTriangle, 'grey', () => a.type, () => '/admin'];
                return (
                  <button key={`${a.type}-${a.gymId || i}`} type="button" data-attention={a.type} onClick={() => navigate(link(a))}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 4px', background: 'none', border: 'none', borderTop: i ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'DM Sans, sans-serif' }}>
                    <Icon size={16} color={toneColor[tone]} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>{text(a)}</span>
                    <ChevronRight size={15} color="var(--text-muted)" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section style={{ ...card, padding: 18 }} aria-labelledby="admin-newest">
          <div id="admin-newest" style={{ ...sectionLabel, marginBottom: 10 }}>{t('admin.newestGyms')}</div>
          {o.recentGyms.length === 0 ? <Empty icon={Building2} title={t('admin.noGymsYet')} /> : o.recentGyms.map((g, i) => (
            <button key={g.id} type="button" onClick={() => navigate(`/admin/gyms/${g.id}`)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', background: 'none', border: 'none', borderTop: i ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{[g.city, g.country].filter(Boolean).join(', ') || g.code} · {day(g.createdAt)}</div>
              </div>
              <span style={{ fontSize: 11.5, color: g.onTrial ? 'var(--accent-yellow)' : 'var(--accent-green)', fontWeight: 600, whiteSpace: 'nowrap' }}>{g.onTrial ? nt(t, 'admin.trialDaysLeft', { n: g.trialDaysLeft }) : t('admin.paying')}</span>
            </button>
          ))}
        </section>
      </div>

      <section style={{ ...card, padding: 18 }} aria-labelledby="admin-monthly">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div id="admin-monthly" style={sectionLabel}>{t('admin.billedAndPaid')}</div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans, sans-serif' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent-gold)' }} />{t('admin.billed')}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent-green)' }} />{t('admin.paid')}</span>
          </div>
        </div>
        <div data-monthly-chart style={{ display: 'grid', gridTemplateColumns: `repeat(${o.monthly.length}, minmax(0, 1fr))`, gap: isMobile ? 6 : 14, alignItems: 'end', height: 150, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 2 }}>
          {o.monthly.map(m => (
            <div key={m.period} role="img" aria-label={t('admin.monthBar', { month: monthLabel(m.period, lang), billed: money(m.billed, cur), paid: money(m.paid, cur) })}
              title={`${monthLabel(m.period, lang)}: ${money(m.billed, cur)} / ${money(m.paid, cur)}`}
              style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: '100%' }}>
              <span style={{ width: '38%', maxWidth: 22, height: `${(m.billed / top) * 100}%`, minHeight: m.billed ? 3 : 0, background: 'var(--accent-gold)', borderRadius: '4px 4px 0 0' }} />
              <span style={{ width: '38%', maxWidth: 22, height: `${(m.paid / top) * 100}%`, minHeight: m.paid ? 3 : 0, background: 'var(--accent-green)', borderRadius: '4px 4px 0 0' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${o.monthly.length}, minmax(0, 1fr))`, gap: isMobile ? 6 : 14, marginTop: 6 }}>
          {o.monthly.map(m => <span key={m.period} style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>{monthLabel(m.period, lang).slice(0, 3)}</span>)}
        </div>
      </section>
    </div>
  );
}
