// Text messages (SMS) go through one provider, chosen by SMS_PROVIDER. Adding a
// provider is one entry in PROVIDERS: a check that it is configured and a send
// that resolves with the provider's message id or throws with a readable reason.
//
//   SMS_PROVIDER=twilio  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either
//                        TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM (the
//                        registered sender name, e.g. "EliteFit", or a number)
//   SMS_PROVIDER=log     nothing leaves the server: each text is written to the
//                        log and counted as sent. For trying GEM out only.
const PROVIDERS = {
  twilio: {
    label: 'Twilio',
    configured: () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM)),
    async send({ to, body }) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const form = new URLSearchParams({ To: to, Body: body });
      if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
      else form.set('From', process.env.TWILIO_FROM);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error_code) throw new Error(data.message || data.error_message || `Twilio refused the message (${res.status})`);
      return { id: data.sid };
    },
  },
  log: {
    label: 'Test mode',
    test: true,
    configured: () => true,
    async send({ to, body }) {
      console.log(`[sms test mode] to ${to}: ${body}`);
      return { id: `test-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
    },
  },
};

const current = () => PROVIDERS[String(process.env.SMS_PROVIDER || '').trim().toLowerCase()] || null;

// What the Communication page shows about texting
function smsStatus() {
  const p = current();
  if (!p) return { ready: false, provider: null, testMode: false, reason: 'not_set_up' };
  if (!p.configured()) return { ready: false, provider: p.label, testMode: false, reason: 'missing_keys' };
  return { ready: true, provider: p.label, testMode: !!p.test };
}

async function sendSms({ to, body }) {
  const p = current();
  if (!p || !p.configured()) throw new Error('Texting is not set up');
  return p.send({ to, body });
}

// GSM-7 texts carry 160 characters (153 a part once split); anything outside
// that alphabet (ê, ç, emoji...) makes the whole text Unicode: 70 (67 a part).
const GSM7 = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;
function smsParts(text) {
  const s = String(text || '');
  if (!s) return 0;
  const gsm = GSM7.test(s);
  const len = gsm ? [...s].reduce((n, c) => n + ('^{}\\[~]|€'.includes(c) ? 2 : 1), 0) : [...s].length;
  const single = gsm ? 160 : 70, part = gsm ? 153 : 67;
  return len <= single ? 1 : Math.ceil(len / part);
}

module.exports = { smsStatus, sendSms, smsParts };
