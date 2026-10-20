import { AlertCircle, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

// What a list or panel shows when it could not be loaded, so a failed load is
// never mistaken for an empty one. onRetry adds a Try again button.
export default function LoadFailed({ message, onRetry, style }) {
  const { t } = useLanguage();
  return (
    <div role="alert" data-load-failed style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: 'var(--accent-red-dim)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10,
      padding: '10px 14px', fontSize: 12.5, color: 'var(--accent-red)', fontFamily: 'DM Sans', lineHeight: 1.45,
      ...style,
    }}>
      <AlertCircle size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: '1 1 160px', minWidth: 0 }}>{message || t('common.loadFailed')}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid currentColor',
          borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: 'inherit', cursor: 'pointer', fontFamily: 'DM Sans',
        }}>
          <RefreshCw size={12} /> {t('common.retry')}
        </button>
      )}
    </div>
  );
}
