import { useEffect } from 'react';

export default function BottomSheet({ open, onClose, title, children, height = '85vh' }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 498,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 499,
          background: 'var(--bg-secondary)',
          borderRadius: '20px 20px 0 0',
          borderTop: '1px solid var(--border-subtle)',
          maxHeight: height,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            display: 'flex', justifyContent: 'center',
            padding: '12px 0 0',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36, height: 4, borderRadius: 2,
              background: 'var(--border-subtle)',
            }}
          />
        </div>

        {/* Title */}
        {title && (
          <div
            style={{
              padding: '12px 20px 14px',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: 16, fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              {title}
            </span>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
          {children}
        </div>
      </div>
    </>
  );
}
