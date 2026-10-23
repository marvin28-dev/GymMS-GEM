import { useState, useCallback, useEffect } from 'react';
import translations from '../i18n/translations';
import { LanguageContext } from './LanguageContext';
import { readStored, store } from '../utils/storage';

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => readStored('gem-lang') || 'en');

  // The page's own language, so screen readers read French as French
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const switchLang = useCallback((newLang) => {
    setLang(newLang);
    store('gem-lang', newLang);
  }, []);

  const t = useCallback((key, vars) => {
    const keys = key.split('.');
    let result = translations[lang];
    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) break;
    }
    if (result === undefined) {
      if (lang !== 'en') {
        if (import.meta.env.DEV) console.warn('[i18n] missing', lang, 'key:', key);
      }
      result = translations['en'];
      for (const k of keys) {
        result = result?.[k];
        if (result === undefined) break;
      }
    }
    if (result === undefined) return key;
    if (vars && typeof result === 'string') {
      return result.replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? `{${v}}`);
    }
    return result;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, switchLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
