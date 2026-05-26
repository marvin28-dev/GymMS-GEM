export default function PageHeader({ title, subtitle, children }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: 'Manrope, sans-serif',
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 4,
              margin: '4px 0 0 0',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {children}
        </div>
      )}
    </div>
  );
}
