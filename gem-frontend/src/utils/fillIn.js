// The fill-ins a message to members can carry ({firstName} and the like), and
// whether a member can be emailed.
export const hasEmail = (m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(m?.email || '').trim());

// {firstName} and the like, filled in from one person's values (the server's
// sample: lower-case keys, as in gem-backend/src/utils/messaging.js fieldValues)
const FILL_IN = /\{\s*([a-zA-Z]+)\s*\}/g;
export const hasFillIns = (text) => /\{\s*[a-zA-Z]+\s*\}/.test(String(text || ''));
export const fillIn = (text, sample) => String(text || '').replace(FILL_IN, (all, key) => (sample && key.toLowerCase() in sample ? sample[key.toLowerCase()] : all));

// The words that fill in per person, as the Communication page offers them
export const TOKENS = [['firstName', 'tokFirstName'], ['endDate', 'tokEndDate'], ['balance', 'tokBalance'], ['gymName', 'tokGymName'], ['gymPhone', 'tokGymPhone']];
