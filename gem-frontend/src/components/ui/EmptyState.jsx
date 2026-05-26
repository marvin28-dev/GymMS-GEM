export default function EmptyState({ icon: Icon, title, message }) {
  return (
    <div
      style={{
        padding: '60px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {Icon && (
        <div style={{ marginBottom: 12 }}>
          <Icon size={40} color="var(--text-muted)" strokeWidth={1.5} />
        </div>
      )}
      {title && (
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 6,
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {title}
        </div>
      )}
      {message && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            fontFamily: 'DM Sans, sans-serif',
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
