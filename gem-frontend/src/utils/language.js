import { store } from './storage';

// The two languages GEM is written in, and the screen's own (kept in this
// browser as gem-lang). Each account has one too (Staff.language): signing in
// switches the screen to it, and changing it on your profile does the same.
export const LANGUAGES = ['en', 'fr'];
export const LANGUAGE_EVENT = 'gem:language';

// Shows the screen in this language now, on whatever page is open
export function showInLanguage(lang) {
  if (!LANGUAGES.includes(lang)) return;
  store('gem-lang', lang);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: lang }));
}

// Each language named in itself, as the choice shows it
export const LANGUAGE_NAMES = { en: 'English', fr: 'Français' };
export const languageName = (lang) => LANGUAGE_NAMES[lang] || LANGUAGE_NAMES.en;
