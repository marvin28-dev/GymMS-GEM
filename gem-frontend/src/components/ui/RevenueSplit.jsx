import { useLanguage } from '../../contexts/LanguageContext';
import { formatMoney } from '../../utils/currency';

// "Members 38 000 FCFA · Shop 7 000 FCFA" under a revenue total. Each half
// stays on one line, so a narrow card breaks between them, never inside an amount.
export default function RevenueSplit({ members, shop }) {
  const { t } = useLanguage();
  return (
    <>
      <span style={{ whiteSpace: 'nowrap' }}>{t('reports.revMembersPart', { amount: formatMoney(members) })}</span>
      {' · '}
      <span style={{ whiteSpace: 'nowrap' }}>{t('reports.revShopPart', { amount: formatMoney(shop) })}</span>
    </>
  );
}
