import { useLanguage } from '../contexts/LanguageContext';
import SupportLinks from './SupportLinks';
import PoweredBy from './ui/PoweredBy';

// The foot of every signed-in screen (AppLayout and the front desk): who to
// contact when something is not working, then the maker's credit, both quiet.
export default function AppFooter({ style }) {
  const { t } = useLanguage();
  return (
    <footer data-app-footer style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center', ...style }}>
      <SupportLinks quiet label={t('common.supportLine')} />
      <PoweredBy style={{ fontSize: 10.5 }} />
    </footer>
  );
}
