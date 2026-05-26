import { createContext, useContext, useState, useCallback } from 'react';
import translations from '../i18n/translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('gem-lang') || 'en');

  const switchLang = useCallback((newLang) => {
    setLang(newLang);
    localStorage.setItem('gem-lang', newLang);
  }, []);

  const t = useCallback((key) => {
    const keys = key.split('.');
    let result = translations[lang];
    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) break;
    }
    // Fallback to English if key missing in current lang
    if (result === undefined) {
      result = translations['en'];
      for (const k of keys) {
        result = result?.[k];
        if (result === undefined) break;
      }
    }
    return result ?? key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, switchLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
