import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export default function Modal({ open, onClose, title, children, maxWidth = 560, hideClose = false }) {
  const { t } = useLanguage();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  const hideCloseRef = useRef(hideClose);
  useEffect(() => { hideCloseRef.current = hideClose; });

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      // When close is hidden (money has been collected and must be refunded to
      // back out), Escape must not be a silent escape hatch either.
      if (e.key === 'Escape' && !hideCloseRef.current) onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay-enter"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !hideCloseRef.current) onCloseRef.current(); }}
    >
      <div
        className="modal-content-enter"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-elevated)',
          width: '100%',
          maxWidth: maxWidth,
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'Manrope, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </span>
          {!hideClose && (
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              borderRadius: 6,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={16} strokeWidth={2} />
          </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
