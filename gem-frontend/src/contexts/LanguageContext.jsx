import { createContext, useContext, useState, useCallback } from 'react';
import translations from '../i18n/translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('gem-lang') || 'en');

  const switchLang = useCallback((newLang) => {
    setLang(newLang);
    localStorage.setItem('gem-lang', newLang);
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

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}

if (import.meta.env.DEV) {
  function flatKeys(obj, prefix = '') {
    return Object.entries(obj).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null ? flatKeys(v, prefix ? `${prefix}.${k}` : k) : [`${prefix ? `${prefix}.` : ''}${k}`]
    );
  }
  const enKeys = new Set(flatKeys(translations.en));
  const frKeys = new Set(flatKeys(translations.fr));
  enKeys.forEach(k => { if (!frKeys.has(k)) console.warn('[i18n parity] missing fr key:', k); });
  frKeys.forEach(k => { if (!enKeys.has(k)) console.warn('[i18n parity] extra fr key (no en):', k); });
}
