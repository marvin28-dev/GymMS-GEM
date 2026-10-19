import { useLanguage } from '../../contexts/LanguageContext';
import StatusBadge from './StatusBadge';

// Who someone is, then where they stand: "Visitor · Expired", "Member · Cancelled".
// Used wherever a member's status is shown, so every screen reads the same.
// An active visitor is stored with the status 'visitor', which reads as Active
// here because the first tag already says they are a visitor.
// typeOnly drops the status, for lists where the second tag says something else
// (a check-in list shows how the visit was paid for instead).
export default function MemberStatusTags({ member, vertical = false, typeOnly = false }) {
  const { t } = useLanguage();
  if (!member) return null;
  if (member._isStaff || member.status === 'staff') return <StatusBadge status={member.status} />;
  const visitor = !!member.isVisitor || member.status === 'visitor';
  const status = member.status === 'visitor' ? 'active' : member.status;
  const color = visitor ? '#a78bfa' : 'var(--accent-gold)';
  return (
    <span style={{ display: 'inline-flex', flexDirection: vertical ? 'column' : 'row', alignItems: vertical ? 'flex-end' : 'center', gap: vertical ? 4 : 6, flexWrap: 'wrap' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', borderRadius: 20, padding: '2px 9px',
        fontSize: 11, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
        color, border: `1px solid ${color}`, background: 'transparent',
      }}>
        {visitor ? t('members.typeVisitor') : t('members.typeMember')}
      </span>
      {!typeOnly && <StatusBadge status={status} />}
    </span>
  );
}
