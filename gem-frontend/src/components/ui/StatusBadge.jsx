const STATUS_MAP = {
  // ── Member statuses ──────────────────────────────────────────────────────
  pending: {
    bg: 'rgba(99,102,241,0.12)',
    color: '#6366f1',
    label: 'Not Started',
  },
  active: {
    bg: 'rgba(52,211,153,0.12)',
    color: '#10b981',
    label: 'Active',
  },
  frozen: {
    bg: 'rgba(96,165,250,0.12)',
    color: '#3b82f6',
    label: 'Frozen',
  },
  deactivated: {
    bg: 'rgba(248,113,113,0.12)',
    color: '#ef4444',
    label: 'Deactivated',
  },
  expired: {
    bg: 'rgba(251,146,60,0.12)',
    color: '#f97316',
    label: 'Expired',
  },
  suspended: {
    bg: 'rgba(239,68,68,0.12)',
    color: '#ef4444',
    label: 'Suspended',
  },
  registered: {
    bg: 'rgba(212,175,55,0.12)',
    color: '#c9a96e',
    label: 'Registered',
  },
  // ── Legacy / other statuses ──────────────────────────────────────────────
  expiring: {
    bg: 'rgba(251,191,36,0.12)',
    color: '#f59e0b',
    label: 'Expiring Soon',
  },
  visitor: {
    bg: 'rgba(167,139,250,0.12)',
    color: '#8b5cf6',
    label: 'Visitor',
  },
  staff: {
    bg: 'rgba(201,169,110,0.12)',
    color: '#c9a96e',
    label: 'Staff',
  },
  inactive: {
    bg: 'rgba(90,90,106,0.12)',
    color: 'var(--text-muted)',
    label: 'Inactive',
  },
  overdue: {
    bg: 'rgba(248,113,113,0.12)',
    color: '#ef4444',
    label: 'Overdue',
  },
  'in progress': {
    bg: 'rgba(96,165,250,0.12)',
    color: '#3b82f6',
    label: 'In Progress',
  },
  done: {
    bg: 'rgba(52,211,153,0.12)',
    color: '#10b981',
    label: 'Done',
  },
};

const DEFAULT_CONFIG = {
  bg: 'rgba(90,90,106,0.15)',
  color: 'var(--text-muted)',
  label: '',
};

export default function StatusBadge({ status }) {
  const key = (status || '').toLowerCase();
  const config = STATUS_MAP[key] || { ...DEFAULT_CONFIG, label: status || '' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: config.bg,
        color: config.color,
        borderRadius: 20,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'DM Sans, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: config.color,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}
