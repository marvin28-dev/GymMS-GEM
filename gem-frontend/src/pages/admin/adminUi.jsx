// The admin dashboard's own small components: figures, pills, titles, and the
// bill and reason dialogs shared by the Billing page and a gym's page
import { useState } from 'react';
import Modal from '../../components/ui/Modal';
import GemInput from '../../components/ui/GemInput';
import GemSelect from '../../components/ui/GemSelect';
import { todayStr } from '../../utils/date';
import { digitsOnly } from '../../utils/number';
import { card, goldBtn, plainBtn, dangerBtn, sectionLabel, field, money, day, monthLabel, nt, refusal } from './adminFormat';

const TONES = {
  gold: ['var(--accent-gold)', 'var(--accent-gold-dim)'],
  green: ['var(--accent-green)', 'var(--accent-green-dim)'],
  red: ['var(--accent-red)', 'var(--accent-red-dim)'],
  amber: ['var(--accent-yellow)', 'var(--accent-yellow-dim)'],
  blue: ['var(--accent-blue)', 'var(--accent-blue-dim)'],
  purple: ['var(--accent-purple)', 'var(--accent-purple-dim)'],
  grey: ['var(--text-secondary)', 'var(--bg-elevated)'],
};

export function Pill({ tone = 'grey', children, ...rest }) {
  const [fg, bg] = TONES[tone] || TONES.grey;
  return (
    <span {...rest} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', color: fg, background: bg, fontFamily: 'DM Sans, sans-serif' }}>
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: fg }} />{children}
    </span>
  );
}

// One figure on a tile, with a line under it
export function Stat({ label, value, sub, tone, onClick, ...rest }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} {...rest}
      style={{ ...card, padding: '14px 16px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, font: 'inherit' }}>
      <span style={{ ...sectionLabel, fontSize: 10.5 }}>{label}</span>
      <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color: tone ? TONES[tone][0] : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>{sub}</span>}
    </Tag>
  );
}

export function PageTitle({ title, subtitle, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, textWrap: 'balance' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0', fontFamily: 'DM Sans, sans-serif' }}>{subtitle}</p>}
      </div>
      {children && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>}
    </div>
  );
}

export function Empty({ icon: Icon, title, hint }) {
  return (
    <div data-empty style={{ padding: '36px 16px', textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>
      {Icon && <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}><Icon size={20} color="var(--text-muted)" /></div>}
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</div>
      {hint && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Problem({ children }) {
  return children ? <div role="alert" data-field-error style={{ fontSize: 12.5, color: 'var(--accent-red)', background: 'var(--accent-red-dim)', borderRadius: 10, padding: '9px 12px', fontFamily: 'DM Sans, sans-serif' }}>{children}</div> : null;
}

// Filter chips with a count on each
export function Chips({ items, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map(([key, text, n]) => {
        const on = value === key;
        return (
          <button key={key} type="button" aria-pressed={on} data-chip={key} onClick={() => onChange(key)}
            style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', border: `1px solid ${on ? 'var(--accent-gold)' : 'var(--border-subtle)'}`, background: on ? 'var(--accent-gold-dim)' : 'transparent', color: on ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
            {text}{n !== undefined && <span style={{ marginLeft: 5, fontVariantNumeric: 'tabular-nums' }}>{n}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Where a gym stands, as one pill: paused, overdue, on trial, or paying
export function GymPill({ g, t }) {
  if (g.locked) return <Pill tone="red" data-gym-state="paused">{t('admin.paused')}</Pill>;
  if (g.owes.overdue > 0) return <Pill tone="red" data-gym-state="overdue">{t('admin.overdue')}</Pill>;
  if (g.onTrial) return <Pill tone="amber" data-gym-state="trial">{nt(t, 'admin.trialDaysLeft', { n: g.trialDaysLeft })}</Pill>;
  return <Pill tone="green" data-gym-state="paying">{t('admin.paying')}</Pill>;
}

// A bill's state as a pill: draft, due by, overdue, paid, void
export function BillPill({ inv, t }) {
  const look = {
    draft: ['grey', t('admin.billDraft')],
    sent: ['blue', t('admin.billDueBy', { date: day(inv.dueDate) })],
    overdue: ['red', nt(t, 'admin.billOverdue', { n: inv.daysOverdue })],
    paid: ['green', t('admin.billPaidOn', { date: day(inv.paidAt) })],
    void: ['grey', t('admin.billVoid')],
  }[inv.state] || ['grey', inv.state];
  return <Pill tone={look[0]} data-bill-state={inv.state}>{look[1]}</Pill>;
}

const dialogButtons = (t, onClose, confirm, busy, save, style = goldBtn, data = {}) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
    <button type="button" style={plainBtn} onClick={onClose}>{t('common.cancel')}</button>
    <button type="button" {...data} style={{ ...style, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={save}>{confirm}</button>
  </div>
);

// Change a draft's figures; the amount follows them
export function EditBillModal({ inv, onClose, onSave, t, lang }) {
  const [f, setF] = useState(() => ({ members: String(inv.members), rate: String(inv.rate), discount: String(inv.discount || 0), note: inv.note || '' }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const n = (v) => Number(v) || 0;
  const amount = Math.max(0, Math.round((n(f.members) * n(f.rate) * inv.billableDays) / Math.max(1, inv.daysInPeriod)) - n(f.discount));
  const save = async () => {
    setBusy(true); setErr('');
    try { await onSave({ members: n(f.members), rate: n(f.rate), discount: n(f.discount), note: f.note }); onClose(); } catch (e) { setErr(refusal(e, t('admin.saveFailed'))); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('admin.editBillTitle', { gym: inv.gym?.name || '', month: monthLabel(inv.period, lang) })} maxWidth={460}>
      <div data-edit-bill style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <GemInput label={t('admin.members')} inputMode="numeric" value={f.members} onChange={e => setF({ ...f, members: digitsOnly(e.target.value) })} />
          <GemInput label={t('admin.pricePerMember')} inputMode="numeric" value={f.rate} onChange={e => setF({ ...f, rate: digitsOnly(e.target.value) })} />
        </div>
        <GemInput label={t('admin.discount')} inputMode="numeric" value={f.discount} onChange={e => setF({ ...f, discount: digitsOnly(e.target.value) })} />
        <GemInput label={t('admin.noteForGym')} value={f.note} maxLength={500} onChange={e => setF({ ...f, note: e.target.value })} />
        {inv.billableDays < inv.daysInPeriod && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{t('admin.daysCharged', { n: inv.billableDays, of: inv.daysInPeriod })}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...card, boxShadow: 'none', background: 'var(--bg-elevated)', padding: '12px 14px' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('admin.amount')}</span>
          <span data-bill-amount style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{money(amount, inv.currency)}</span>
        </div>
        <Problem>{err}</Problem>
        {dialogButtons(t, onClose, t('common.save'), busy, save, goldBtn, { 'data-edit-save': true })}
      </div>
    </Modal>
  );
}

const METHODS = ['mobile_money', 'bank_transfer', 'cash', 'card'];

// Record that a gym paid; reopens a paused account unless told not to
export function PaidModal({ inv, locked, onClose, onSave, t }) {
  const [f, setF] = useState({ method: 'mobile_money', amount: String(inv.amount), paidOn: todayStr(), reference: '', reopen: true });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr('');
    try { await onSave({ method: f.method, amount: Number(f.amount) || 0, paidOn: f.paidOn, reference: f.reference, reopen: f.reopen }); onClose(); } catch (e) { setErr(refusal(e, t('admin.saveFailed'))); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('admin.markPaidTitle', { gym: inv.gym?.name || '' })} maxWidth={440}>
      <div data-paid-form style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <GemSelect label={t('admin.paidBy')} value={f.method} onChange={e => setF({ ...f, method: e.target.value })} options={METHODS.map(m => ({ value: m, label: t(`admin.method_${m}`) }))} />
        <div className="gem-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <GemInput label={t('admin.amountPaid')} inputMode="numeric" value={f.amount} onChange={e => setF({ ...f, amount: digitsOnly(e.target.value) })} />
          <GemInput label={t('admin.paidOn')} type="date" max={todayStr()} value={f.paidOn} onChange={e => setF({ ...f, paidOn: e.target.value })} />
        </div>
        <GemInput label={t('admin.reference')} value={f.reference} maxLength={120} onChange={e => setF({ ...f, reference: e.target.value })} placeholder={t('admin.referencePh')} />
        {locked && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            <input type="checkbox" data-reopen checked={f.reopen} onChange={e => setF({ ...f, reopen: e.target.checked })} style={{ accentColor: '#c9a96e', width: 16, height: 16 }} />
            {t('admin.reopenOnPay')}
          </label>
        )}
        <Problem>{err}</Problem>
        {dialogButtons(t, onClose, t('admin.markPaid'), busy, save, goldBtn, { 'data-paid-save': true })}
      </div>
    </Modal>
  );
}

// A short text asked for before something happens: why a bill is voided, why
// an account is paused
export function ReasonModal({ title, label, hint, confirm, required, danger, onClose, onSave, t }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (required && !text.trim()) { setErr(t('admin.reasonNeeded')); return; }
    setBusy(true); setErr('');
    try { await onSave(text.trim()); onClose(); } catch (e) { setErr(refusal(e, t('admin.saveFailed'))); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={title} maxWidth={440}>
      <div data-reason-form style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {hint && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, fontFamily: 'DM Sans, sans-serif' }}>{hint}</p>}
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, fontFamily: 'DM Sans, sans-serif' }} htmlFor="admin-reason">{label}{required ? ' *' : ''}</label>
        <textarea id="admin-reason" value={text} onChange={e => { setText(e.target.value); setErr(''); }} rows={3} maxLength={500}
          style={{ ...field, borderColor: err ? 'var(--accent-red)' : 'var(--border-subtle)', resize: 'vertical' }} />
        <Problem>{err}</Problem>
        {dialogButtons(t, onClose, confirm, busy, save, danger ? dangerBtn : goldBtn, { 'data-reason-save': true })}
      </div>
    </Modal>
  );
}
