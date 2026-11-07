// Where the Support page's reports are sent: GEM's own support address, the
// one the screens show (gem-frontend/src/utils/support.js; given by the owner
// on 30 October 2026). SUPPORT_EMAIL names another.
const supportEmail = () => String(process.env.SUPPORT_EMAIL || 'marvin.ekokobe01@gmail.com').trim();

module.exports = { supportEmail };
