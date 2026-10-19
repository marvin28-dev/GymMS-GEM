import { useLanguage } from '../../contexts/LanguageContext';

const STATUS_STYLE = {
  pending:      { bg: 'rgba(99,102,241,0.12)',  color: '#6366f1',  key: 'status.pending' },
  active:       { bg: 'rgba(52,211,153,0.12)',  color: '#10b981',  key: 'status.active' },
  frozen:       { bg: 'rgba(96,165,250,0.12)',  color: '#3b82f6',  key: 'status.frozen' },
  deactivated:  { bg: 'rgba(248,113,113,0.12)', color: '#ef4444',  key: 'status.deactivated' },
  cancelled:    { bg: 'rgba(148,163,184,0.14)', color: '#94a3b8',  key: 'status.cancelled' },
  expired:      { bg: 'rgba(251,146,60,0.12)',  color: '#f97316',  key: 'status.expired' },
  suspended:    { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444',  key: 'status.suspended' },
  registered:   { bg: 'rgba(212,175,55,0.12)',  color: '#c9a96e',  key: 'status.registered' },
  expiring:     { bg: 'rgba(251,191,36,0.12)',  color: '#f59e0b',  key: 'status.expiringSoon' },
  visitor:      { bg: 'rgba(167,139,250,0.12)', color: '#8b5cf6',  key: 'status.visitor' },
  staff:        { bg: 'rgba(201,169,110,0.12)', color: '#c9a96e',  key: 'status.staff' },
  inactive:     { bg: 'rgba(90,90,106,0.12)',   color: 'var(--text-muted)', key: 'status.inactive' },
  overdue:      { bg: 'rgba(248,113,113,0.12)', color: '#ef4444',  key: 'status.overdue' },
  'in progress':{ bg: 'rgba(96,165,250,0.12)',  color: '#3b82f6',  key: 'status.inProgress' },
  done:         { bg: 'rgba(52,211,153,0.12)',  color: '#10b981',  key: 'status.done' },
  open:         { bg: 'rgba(99,102,241,0.12)',  color: '#6366f1',  key: 'status.open' },
  accepted:     { bg: 'rgba(52,211,153,0.12)',  color: '#10b981',  key: 'status.accepted' },
  declined:     { bg: 'rgba(248,113,113,0.12)', color: '#ef4444',  key: 'status.declined' },
};

const DEFAULT_STYLE = {
  bg: 'rgba(90,90,106,0.15)',
  color: 'var(--text-muted)',
};

export default function StatusBadge({ status }) {
  const { t } = useLanguage();
  const key = (status || '').toLowerCase();
  const style = STATUS_STYLE[key] || DEFAULT_STYLE;
  const label = style.key ? t(style.key) : (status || '');

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: style.bg,
        color: style.color,
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
          background: style.color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
