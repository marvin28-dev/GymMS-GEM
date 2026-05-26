import Modal from './Modal';

const primaryBtnStyle = {
  background: 'linear-gradient(135deg, #c9a96e, #b08d4a)',
  color: '#0a0a0f',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif',
};

const dangerBtnStyle = {
  background: 'linear-gradient(135deg, #f87171, #ef4444)',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif',
};

const secondaryBtnStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif',
};

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={420}>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: 13,
          lineHeight: 1.6,
          margin: '0 0 24px 0',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        {message}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button style={secondaryBtnStyle} onClick={onClose}>
          Cancel
        </button>
        <button
          style={danger ? dangerBtnStyle : primaryBtnStyle}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
