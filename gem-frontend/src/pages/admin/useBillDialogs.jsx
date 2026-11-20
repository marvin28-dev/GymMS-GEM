import { useState } from 'react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { updateInvoice, sendInvoice, markInvoicePaid, remindInvoice, voidInvoice, lockGym } from '../../services/admin.service';
import { EditBillModal, PaidModal, ReasonModal } from './adminUi';
import { money, monthLabel, refusal } from './adminFormat';

// What a bill's row menu opens, for the Billing page and a gym's page alike.
// Anything that reaches the gym (sending, a reminder) is confirmed first.
export function useBillDialogs({ t, lang, onChanged, isLocked = () => false }) {
  const [dlg, setDlg] = useState(null);
  const [problem, setProblem] = useState('');
  const close = () => setDlg(null);
  const act = (work) => async () => {
    setProblem('');
    try { await work(); onChanged(); } catch (e) { setProblem(refusal(e, t('admin.saveFailed'))); }
    setDlg(null);
  };
  const open = (kind, inv) => { setProblem(''); setDlg({ kind, inv }); };
  const inv = dlg?.inv;
  const what = inv ? { gym: inv.gym?.name || '', month: monthLabel(inv.period, lang), amount: money(inv.amount, inv.currency) } : {};

  const dialogs = !dlg ? null : (
    <>
      {dlg.kind === 'edit' && <EditBillModal inv={inv} t={t} lang={lang} onClose={close} onSave={async (data) => { await updateInvoice(inv.id, data); onChanged(); }} />}
      {dlg.kind === 'paid' && <PaidModal inv={inv} t={t} locked={isLocked(inv)} onClose={close} onSave={async (data) => { await markInvoicePaid(inv.id, data); onChanged(); }} />}
      {dlg.kind === 'void' && (
        <ReasonModal t={t} danger title={t('admin.voidTitle', what)} hint={t('admin.voidHint')} label={t('admin.voidReason')} confirm={t('admin.voidBill')}
          onClose={close} onSave={async (reason) => { await voidInvoice(inv.id, reason); onChanged(); }} />
      )}
      {dlg.kind === 'lock' && (
        <ReasonModal t={t} danger required title={t('admin.pauseTitle', { gym: what.gym })} hint={t('admin.pauseHint')} label={t('admin.pauseReason')} confirm={t('admin.pauseAccount')}
          onClose={close} onSave={async (reason) => { await lockGym(inv.gymId, reason); onChanged(); }} />
      )}
      <ConfirmModal open={dlg.kind === 'send'} danger={false} onClose={close} onConfirm={act(() => sendInvoice(inv.id))}
        title={t('admin.sendTitle')} message={t('admin.sendMessage', what)} confirmLabel={t('admin.sendBill')} />
      <ConfirmModal open={dlg.kind === 'remind'} danger={false} onClose={close} onConfirm={act(() => remindInvoice(inv.id))}
        title={t('admin.remindTitle')} message={t('admin.remindMessage', what)} confirmLabel={t('admin.remind')} />
    </>
  );
  return { open, dialogs, problem };
}
