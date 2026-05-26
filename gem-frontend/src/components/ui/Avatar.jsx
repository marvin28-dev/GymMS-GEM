const COLOR_MAP = {
  gold: { bg: 'var(--accent-gold-dim)', color: 'var(--accent-gold)' },
  blue: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
  green: { bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
  red: { bg: 'var(--accent-red-dim)', color: 'var(--accent-red)' },
  purple: { bg: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' },
};

const DEFAULT_COLORS = { bg: 'var(--accent-gold-dim)', color: 'var(--accent-gold)' };

export default function Avatar({ firstName = '', lastName = '', avatarColor = 'gold', size = 32 }) {
  const colors = COLOR_MAP[avatarColor] || DEFAULT_COLORS;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colors.bg,
        color: colors.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: Math.round(size * 0.38),
        fontFamily: 'DM Sans, sans-serif',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  );
}
