// F-150: every translation key the code names exists in English and French,
// so removing unused keys (or a typo) can never put a raw key on screen.
// Keys built at run time (t(`staff.${k}`)) are not checked here.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import translations from '../../gem-frontend/src/i18n/translations.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../gem-frontend/src');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(jsx?|mjs)$/.test(e.name) ? [path.join(d, e.name)] : []));
const get = (lang, key) => key.split('.').reduce((o, k) => o?.[k], translations[lang]);
const namespaces = new Set(Object.keys(translations.en));

const named = [];
for (const file of walk(SRC)) {
  if (file.endsWith(path.join('i18n', 'translations.js'))) continue;
  const text = fs.readFileSync(file, 'utf8');
  // The activity log names the server's action codes (auth.code_refused),
  // which look like keys but are not
  const actionCodes = file.endsWith('LogsPage.jsx');
  for (const m of text.matchAll(/['"`]([a-z][A-Za-z]*\.[A-Za-z0-9_]+)['"`]/g)) {
    if (actionCodes && /^[a-z]+\.[a-z]+(_[a-z]+)+$/.test(m[1])) continue;
    if (namespaces.has(m[1].split('.')[0])) named.push([path.relative(SRC, file), m[1]]);
  }
}

describe('translation keys named in the code', () => {
  it('finds the keys it checks', () => {
    expect(named.length).toBeGreaterThan(1000);
  });

  it('exist in English and French', () => {
    const missing = named.filter(([, key]) => typeof get('en', key) !== 'string' || typeof get('fr', key) !== 'string');
    expect(missing.map(([file, key]) => `${file}: ${key}`)).toEqual([]);
  });
});
