import { useLanguage } from '../../contexts/LanguageContext';
import { MAKER } from '../../utils/support';

// The maker's credit, wherever GEM introduces itself: the public pages and the
// foot of the app's menu. The emails and the receipt PDF say the same from the
// server (utils/emailLayout.js), the payslip PDF from utils/paystubPdf.js.
export default function PoweredBy({ style }) {
  const { t } = useLanguage();
  return (
    <p data-powered-by style={{ margin: 0, fontSize: 11, lineHeight: 1.4, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', ...style }}>
      {t('common.poweredBy')} <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{MAKER}</strong>
    </p>
  );
}
