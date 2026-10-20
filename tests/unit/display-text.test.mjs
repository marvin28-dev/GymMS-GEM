// F-133: a package's length, its session limit and a task's assignee are
// stored in English; the screen shows them in the reader's language.
import { describe, it, expect } from 'vitest';
import translations from '../../gem-frontend/src/i18n/translations.js';
import { durationText, sessionsText } from '../../gem-frontend/src/utils/packageText.js';
import { assigneeName } from '../../gem-frontend/src/utils/departments.js';

const translator = (lang) => (key, vars) => {
  const text = key.split('.').reduce((o, k) => o?.[k], translations[lang]);
  if (typeof text !== 'string') return key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? `{${v}}`) : text;
};
const en = translator('en');
const fr = translator('fr');

describe('durationText', () => {
  it('names the length in the reader\'s language, one or many', () => {
    expect(durationText('6 Months', fr)).toBe('6 mois');
    expect(durationText('1 Month', fr)).toBe('1 mois');
    expect(durationText('1 Day', fr)).toBe('1 jour');
    expect(durationText('30 Days', fr)).toBe('30 jours');
    expect(durationText('2 Weeks', fr)).toBe('2 semaines');
    expect(durationText('1 Year', fr)).toBe('1 an');
    expect(durationText('3 Year', en)).toBe('3 years');
    expect(durationText('1 Months', en)).toBe('1 month');
  });

  it('shows anything else as the gym wrote it', () => {
    expect(durationText('Until the end of term', fr)).toBe('Until the end of term');
    expect(durationText(undefined, fr)).toBeUndefined();
  });
});

describe('sessionsText', () => {
  it('translates Unlimited and leaves a number alone', () => {
    expect(sessionsText('Unlimited', fr)).toBe('Illimité');
    expect(sessionsText('12', fr)).toBe('12');
  });
});

describe('assigneeName', () => {
  it('names a department or a job in the reader\'s language', () => {
    expect(assigneeName({ assignedGroup: 'management', assignedTo: 'Management' }, fr)).toBe('Direction');
    expect(assigneeName({ assignedRole: 'trainer', assignedTo: 'All trainers' }, fr)).toBe('Tous les entraîneurs');
    expect(assigneeName({ assignedRole: 'coach', assignedTo: 'coach' }, fr)).toBe('Tous les entraîneurs');
    expect(assigneeName({ assignedRole: 'front_desk', assignedTo: 'The front desk' }, en)).toBe('The front desk');
  });

  it('keeps a person\'s name, and is empty when nobody is set', () => {
    expect(assigneeName({ assignedTo: 'Ama Owusu' }, fr)).toBe('Ama Owusu');
    expect(assigneeName({ assignedTo: '' }, fr)).toBe('');
    expect(assigneeName({}, fr)).toBe('');
  });
});
