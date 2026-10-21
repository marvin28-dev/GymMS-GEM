import { createContext, useContext } from 'react';
import translations from '../i18n/translations';

export const LanguageContext = createContext(null);

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
