// One look for every email GEM sends: a dark band with the gym's name (or
// GEM's own, for account emails), a white card with the message, and the
// gym's contacts underneath. Email clients only honour tables and inline
// styles, so everything here is built from those; text values are escaped
// here, so callers pass plain text unless a block says it takes HTML.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const C = {
  page: '#ecebe7', card: '#ffffff', band: '#111117', ink: '#16161d', body: '#45454f', muted: '#8a8a96',
  hair: '#ececef', gold: '#c9a96e', goldDeep: '#8c6c32', goldSoft: '#faf6ee', goldLine: '#ecdfc5',
  red: '#b4232a', redSoft: '#fdf1f1', redLine: '#f3cfd1', green: '#1d7a46', greenSoft: '#ecf7f0', amber: '#9a6400', amberSoft: '#fdf6e7',
};
const FONT = "'DM Sans','Segoe UI',Helvetica,Arial,sans-serif";
const HEAD = "'Manrope','Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',SFMono-Regular,Consolas,'Courier New',monospace";
const TONES = {
  gold: [C.goldDeep, C.goldSoft, C.goldLine], red: [C.red, C.redSoft, C.redLine],
  green: [C.green, C.greenSoft, '#cfe9da'], amber: [C.amber, C.amberSoft, '#f1dfb6'], grey: [C.body, '#f5f5f7', C.hair],
};

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev';
// Inboxes show who it is from: the gym, sent through GEM
const sender = (gymName) => {
  const clean = String(gymName || '').replace(/["<>\\]/g, '').trim();
  return clean ? `"${clean} via GEM" <${FROM_ADDRESS}>` : `GEM <${FROM_ADDRESS}>`;
};

const longDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

// ── Blocks ──
const p = (text) => `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.body};">${esc(text)}</p>`;
const pHtml = (html) => `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.body};">${html}</p>`;
const strong = (text) => `<strong style="color:${C.ink};font-weight:700;">${esc(text)}</strong>`;
const greeting = (name) => p(`Hi ${String(name || '').trim() || 'there'},`);
const link = (href, text) => `<a href="${esc(href)}" style="color:${C.goldDeep};font-weight:600;text-decoration:underline;">${esc(text || href)}</a>`;

// The one figure the email is about: an amount, a code
function highlight({ label, value, sub, mono = false, tone = 'gold' }) {
  const [fg, bg, line] = TONES[tone] || TONES.gold;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;border-collapse:separate;">
    <tr><td align="center" style="background:${bg};border:1px solid ${line};border-radius:14px;padding:22px 16px;">
      <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${fg};">${esc(label)}</div>
      <div style="font-family:${mono ? MONO : HEAD};font-size:${mono ? 30 : 32}px;font-weight:800;line-height:1.2;color:${C.ink};margin-top:8px;${mono ? 'letter-spacing:6px;' : 'letter-spacing:-0.5px;'}">${esc(value)}</div>
      ${sub ? `<div style="font-family:${FONT};font-size:13px;color:${C.muted};margin-top:6px;">${esc(sub)}</div>` : ''}
    </td></tr>
  </table>`;
}

// Two figures side by side (stacked on a phone)
function tiles(items) {
  const list = items.filter(Boolean);
  const cells = list.map((it, i) => `
      <td class="gem-stack" valign="top" width="${Math.floor(100 / list.length)}%" style="padding:0 ${i < list.length - 1 ? 5 : 0}px 10px ${i ? 5 : 0}px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr>
          <td style="background:${C.goldSoft};border:1px solid ${C.goldLine};border-radius:12px;padding:16px 14px;">
            <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${C.goldDeep};">${esc(it.label)}</div>
            <div style="font-family:${it.mono ? MONO : HEAD};font-size:20px;line-height:28px;font-weight:800;color:${C.ink};margin-top:6px;word-break:break-word;${it.mono ? 'letter-spacing:3px;' : ''}">${esc(it.value)}</div>
          </td>
        </tr></table>
      </td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 10px;"><tr>${cells}</tr></table>`;
}

// Label / value rows; a row with no value is left out rather than showing a dash.
// A value given as { html } is used as it is.
function details(rows, title) {
  const shown = rows.filter(r => r && r[1] !== null && r[1] !== undefined && r[1] !== '');
  if (!shown.length) return '';
  const body = shown.map(([label, value], i) => `
      <tr>
        <td style="padding:11px 0;${i ? `border-top:1px solid ${C.hair};` : ''}font-family:${FONT};font-size:13px;color:${C.muted};vertical-align:top;">${esc(label)}</td>
        <td align="right" style="padding:11px 0 11px 16px;${i ? `border-top:1px solid ${C.hair};` : ''}font-family:${FONT};font-size:14px;font-weight:600;color:${C.ink};vertical-align:top;">${value && typeof value === 'object' ? value.html : esc(value)}</td>
      </tr>`).join('');
  return `
  ${title ? `<div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${C.muted};margin:4px 0 6px;">${esc(title)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;border-top:1px solid ${C.hair};border-bottom:1px solid ${C.hair};">${body}</table>`;
}

const badge = (text, tone = 'gold') => {
  const [fg, bg, line] = TONES[tone] || TONES.gold;
  return { html: `<span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${bg};border:1px solid ${line};color:${fg};font-size:12px;font-weight:700;">${esc(text)}</span>` };
};

function button(href, label) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr>
    <td style="border-radius:10px;background:${C.gold};background-image:linear-gradient(135deg,#c9a96e,#b08d4a);">
      <a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#14141b;text-decoration:none;border-radius:10px;">${esc(label)}</a>
    </td>
  </tr></table>`;
}

// A side remark: a tip, a warning
function note(html, tone = 'gold') {
  const [fg, bg] = TONES[tone] || TONES.gold;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
    <td style="background:${bg};border-left:3px solid ${fg};border-radius:0 10px 10px 0;padding:12px 16px;font-family:${FONT};font-size:13.5px;line-height:1.55;color:${C.body};">${html}</td>
  </tr></table>`;
}

// Numbered steps, each given as HTML
function steps(items) {
  const rowsHtml = items.map((html, i) => `
    <tr>
      <td valign="top" width="34" style="padding:0 0 12px;">
        <div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:${C.goldSoft};border:1px solid ${C.goldLine};color:${C.goldDeep};font-family:${FONT};font-size:12px;font-weight:800;text-align:center;">${i + 1}</div>
      </td>
      <td valign="top" style="padding:2px 0 12px;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.body};">${html}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">${rowsHtml}</table>`;
}

const small = (text) => `<p style="margin:0 0 8px;font-family:${FONT};font-size:12.5px;line-height:1.55;color:${C.muted};">${esc(text)}</p>`;

// ── The frame ──
const initials = (name) => String(name || 'G').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'G';

function bandHtml(brand) {
  const logo = /^https?:\/\//.test(String(brand.logo || ''))
    ? `<img src="${esc(brand.logo)}" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border-radius:10px;object-fit:cover;border:0;">`
    : `<div style="width:40px;height:40px;line-height:40px;border-radius:10px;background:${C.gold};background-image:linear-gradient(135deg,#c9a96e,#b08d4a);text-align:center;font-family:${HEAD};font-size:15px;font-weight:800;color:#14141b;">${esc(initials(brand.name))}</div>`;
  return `
  <tr><td style="background:${C.band};padding:22px 32px;" class="gem-px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" style="padding-right:12px;">${logo}</td>
      <td valign="middle">
        <div style="font-family:${HEAD};font-size:17px;font-weight:800;color:#ffffff;letter-spacing:-0.2px;">${esc(brand.name)}</div>
        ${brand.sub ? `<div style="font-family:${FONT};font-size:12px;color:${C.gold};margin-top:2px;">${esc(brand.sub)}</div>` : ''}
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="height:3px;line-height:3px;font-size:0;background:${C.gold};background-image:linear-gradient(90deg,#c9a96e,#b08d4a);">&nbsp;</td></tr>`;
}

function footerHtml(gym) {
  const lines = [];
  if (gym) {
    const place = [gym.location, gym.city, gym.country].filter(Boolean).join(', ');
    const contact = [
      gym.phone && `<a href="tel:${esc(String(gym.phone).replace(/[^\d+]/g, ''))}" style="color:${C.muted};text-decoration:none;">${esc(gym.phone)}</a>`,
      gym.email && `<a href="mailto:${esc(gym.email)}" style="color:${C.muted};text-decoration:none;">${esc(gym.email)}</a>`,
      gym.website && `<a href="${esc(/^https?:/.test(gym.website) ? gym.website : `https://${gym.website}`)}" style="color:${C.muted};text-decoration:none;">${esc(gym.website)}</a>`,
    ].filter(Boolean);
    const socials = [gym.facebook && `Facebook ${gym.facebook}`, gym.instagram && `Instagram ${gym.instagram}`, gym.twitter && `X ${gym.twitter}`].filter(Boolean);
    lines.push(`<div style="font-family:${HEAD};font-size:13px;font-weight:700;color:${C.body};margin-bottom:4px;">${esc(gym.name)}</div>`);
    if (place) lines.push(`<div>${esc(place)}</div>`);
    if (contact.length) lines.push(`<div>${contact.join(' &nbsp;·&nbsp; ')}</div>`);
    if (socials.length) lines.push(`<div>${socials.map(esc).join(' &nbsp;·&nbsp; ')}</div>`);
  }
  lines.push(`<div style="margin-top:10px;color:#a3a3ad;">Sent with GEM · GymElite Manager</div>`);
  return `
  <tr><td align="center" class="gem-px" style="padding:22px 32px 8px;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.muted};">${lines.join('')}</td></tr>`;
}

// brand: { name, logo?, sub? }; gym: the gym's record for the footer (or null)
function layout({ brand, gym = null, preheader = '', eyebrow, title, body }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
<style>
  @media (max-width:600px){
    .gem-px{padding-left:20px !important;padding-right:20px !important;}
    .gem-title{font-size:22px !important;}
    .gem-stack{display:block !important;width:100% !important;padding-left:0 !important;padding-right:0 !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
      <tr><td style="background:${C.card};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(20,20,30,0.08);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${bandHtml(brand)}
          <tr><td class="gem-px" style="padding:30px 32px 14px;">
            ${eyebrow ? `<div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:${C.goldDeep};margin:0 0 8px;">${esc(eyebrow)}</div>` : ''}
            <h1 class="gem-title" style="margin:0 0 18px;font-family:${HEAD};font-size:25px;line-height:1.25;font-weight:800;color:${C.ink};letter-spacing:-0.4px;">${esc(title)}</h1>
            ${body}
          </td></tr>
        </table>
      </td></tr>
      ${footerHtml(gym)}
    </table>
  </td></tr>
</table>
</body></html>`;
}

const gymBrand = (gym) => ({ name: gym?.name || 'GEM', logo: gym?.logo || null });
const gemBrand = { name: 'GEM', sub: 'GymElite Manager' };

module.exports = {
  esc, sender, longDate, layout, gymBrand, gemBrand,
  p, pHtml, strong, greeting, link, highlight, tiles, details, badge, button, note, steps, small,
};
