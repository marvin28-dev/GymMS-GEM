import { Mail, MessageCircle } from 'lucide-react';
import { SUPPORT, hasSupport } from '../utils/support';

// "Need help?" and GEM's contacts (utils/support.js), on the sign-in and sign-up
// pages. Nothing at all if a build ever has none. `inline` puts the
// line and the links on one row; `quiet` is one line of small text, for the
// foot of every screen, the account menu and the screens that say something
// went wrong.
export default function SupportLinks({ label, style, inline = false, quiet = false }) {
  if (!hasSupport) return null;
  if (quiet) {
    const link = { color: 'var(--accent-gold)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' };
    return (
      <p data-support style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', ...style }}>
        {label}{' '}
        {/* The number is for WhatsApp only, never a call */}
        {SUPPORT.whatsapp && <a href={SUPPORT.whatsappUrl} target="_blank" rel="noreferrer" style={link}>WhatsApp {SUPPORT.whatsappLabel}</a>}
        {SUPPORT.whatsapp && SUPPORT.email && ' · '}
        {SUPPORT.email && <a href={`mailto:${SUPPORT.email}`} style={link}>{SUPPORT.email}</a>}
      </p>
    );
  }
  const chip = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: inline ? 11 : 12, fontWeight: 600, textDecoration: 'none', borderRadius: inline ? 6 : 8, padding: inline ? '4px 10px' : '6px 12px' };
  const links = (
    <>
      {SUPPORT.email && (
        <a href={`mailto:${SUPPORT.email}`} style={{ ...chip, color: 'var(--accent-gold)', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)' }}>
          <Mail size={inline ? 11 : 12} /> {SUPPORT.email}
        </a>
      )}
      {SUPPORT.whatsapp && (
        <a href={SUPPORT.whatsappUrl} target="_blank" rel="noreferrer" style={{ ...chip, color: 'var(--accent-green)', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}>
          <MessageCircle size={inline ? 11 : 12} /> WhatsApp {SUPPORT.whatsappLabel}
        </a>
      )}
    </>
  );
  if (inline) {
    return (
      <div data-support style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', ...style }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
        {links}
      </div>
    );
  }
  return (
    <div data-support style={style}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 12px', letterSpacing: '0.2px' }}>{label}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>{links}</div>
    </div>
  );
}
