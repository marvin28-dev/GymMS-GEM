// F-148, F-149: French that reads as French, one word per thing, and help
// texts that say what the app really does.
import { describe, it, expect } from 'vitest';
import translations from '../../gem-frontend/src/i18n/translations.js';

const get = (lang, key) => key.split('.').reduce((o, k) => o?.[k], translations[lang]);
const allFrench = () => {
  const out = [];
  const walk = (o) => { for (const v of Object.values(o)) { if (typeof v === 'string') out.push(v); else if (v && typeof v === 'object') walk(v); } };
  walk(translations.fr);
  return out;
};

describe('French', () => {
  it('keeps its apostrophes', () => {
    const keys = ['stats.perDaySub', 'staff.roleHint_none', 'staff.roleHint_front_desk', 'staff.roleHint_other', 'staff.joinDateRequired', 'staff.newCodeAction', 'staff.newCodeIssued', 'staff.newCodeFailed', 'attendance.cameToTrain', 'tasks.allOf_front_desk', 'frontDesk.hereToTrain', 'frontDesk.clockNoteRequired', 'frontDesk.clockNotePlaceholder'];
    for (const key of keys) expect(get('fr', key), key).not.toMatch(/\b(s|n|qu|d|l|c|L|C) [aeiouhéèêàâîôûœ]/);
  });

  it('uses one word per thing', () => {
    const text = allFrench().join('\n');
    expect(text).not.toMatch(/gymnase/i);
    expect(text).not.toMatch(/\bRecettes?\b/);
    expect(text).not.toMatch(/\bEmail\b/);
  });

  it('names the system and builds the grace period with its number', () => {
    expect(get('fr', 'tasks.createdBySystem')).toBe('Système');
    for (const lang of ['en', 'fr']) expect(get(lang, 'memberProfile.gracePeriodActive')).toContain('{n}');
  });
});

describe('help texts', () => {
  it('say what the app does', () => {
    for (const lang of ['en', 'fr']) {
      expect(get(lang, 'memberProfile.suspendedMsg')).not.toMatch(/paused|pause/i);
      expect(get(lang, 'settings.expenseLimitHint')).not.toMatch(/without prior approval|sans approbation/i);
      expect(get(lang, 'memberProfile.buyDayPassInfo')).not.toMatch(/visitor rate|tarif visiteur/i);
      expect(get(lang, 'staff.tryRestart')).not.toMatch(/server|serveur/i);
    }
  });
});
