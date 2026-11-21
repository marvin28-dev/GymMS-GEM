// The two languages GEM is written in. Each member and each staff member has
// their own (Member.language, Staff.language): it decides what they are sent
// and, for staff, the language GEM opens in when they sign in. Nothing chosen
// falls back: a member to the gym's language for members, staff to English.
const LANGUAGES = ['en', 'fr'];
const isLanguage = (v) => LANGUAGES.includes(v);

// A language sent with a request: undefined when it was not sent, null to
// clear it, else 'en' or 'fr'. Anything else is refused.
function readLanguage(value) {
  if (value === undefined) return { value: undefined };
  if (value === null || value === '') return { value: null };
  const v = String(value).trim().toLowerCase();
  return isLanguage(v) ? { value: v } : { error: 'Choose English or French.' };
}

const gymLanguage = (gym) => (gym?.settings?.emailLanguage === 'fr' ? 'fr' : 'en');
const memberLanguage = (member, gym) => (isLanguage(member?.language) ? member.language : gymLanguage(gym));
const staffLanguage = (staff) => (isLanguage(staff?.language) ? staff.language : 'en');

module.exports = { LANGUAGES, isLanguage, readLanguage, gymLanguage, memberLanguage, staffLanguage };
