import { Eye } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { fillIn, hasFillIns } from '../utils/smsCount';

// A message with {firstName} and the like reads as code in the box, so this
// shows it as the first person will actually get it. sample is the server's
// values for that person (POST /api/communications/audience -> sample).
export default function FillInPreview({ body, subject = '', sample }) {
  const { t } = useLanguage();
  const showSubject = !!subject.trim();
  if (!hasFillIns(body) && !(showSubject && hasFillIns(subject))) return null;
  return (
    <div data-fill-preview style={{ marginTop: 10, background: 'var(--bg-elevated)', border: '1px dashed var(--accent-gold)', borderRadius: 10, padding: '10px 12px', fontFamily: 'DM Sans' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: 6 }}>
        <Eye size={12} />
        {sample?.name ? t('communication.previewFor', { name: sample.name }) : t('communication.previewEach')}
      </div>
      {sample ? (
        <>
          {showSubject && <div data-fill-subject style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{fillIn(subject, sample)}</div>}
          <div data-fill-body style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.5 }}>{fillIn(body, sample)}</div>
        </>
      ) : (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('communication.previewEachHint')}</div>
      )}
    </div>
  );
}
