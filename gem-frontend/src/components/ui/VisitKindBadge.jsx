import { useLanguage } from '../../contexts/LanguageContext';
import { visitBadge } from '../../utils/checkin';

// The pill that says how a visit was paid for. Check-in lists show it only for
// a pass (onlyPasses), so an ordinary membership visit stays uncluttered.
export default function VisitKindBadge({ kind, isVisitor, onlyPasses = false }) {
  const { t } = useLanguage();
  const b = visitBadge(kind, isVisitor, t);
  if (onlyPasses && b.kind === 'membership') return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
      background: b.bg, color: b.color, borderRadius: 20, padding: '2px 8px',
      fontSize: 10.5, fontWeight: 600, fontFamily: 'DM Sans', lineHeight: 1.5,
    }}>
      {b.label}
    </span>
  );
}
