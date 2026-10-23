// F-009: the server checks its settings as it starts. Without a database or a
// signing secret it stops and names what is missing; anything else only warns.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const { checkConfig } = createRequire(new URL('../../gem-backend/src/app.js', import.meta.url))('./utils/config.js');

const complete = {
  DATABASE_URL: 'postgresql://localhost/gem', JWT_SECRET: 'x'.repeat(40), FRONTEND_URL: 'https://gem.example',
  RESEND_API_KEY: 're_x', CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's',
};

describe('the start-up check', () => {
  it('passes quietly when everything is set', () => {
    expect(checkConfig(complete)).toEqual({ warnings: [] });
  });

  it('stops without a database or a signing secret, naming each', () => {
    expect(() => checkConfig({ ...complete, DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
    expect(() => checkConfig({ ...complete, JWT_SECRET: '  ' })).toThrow(/JWT_SECRET/);
    expect(() => checkConfig({})).toThrow(/DATABASE_URL.*and JWT_SECRET/);
  });

  it('warns about what only switches a feature off, and a short secret', () => {
    const { warnings } = checkConfig({ ...complete, FRONTEND_URL: undefined, RESEND_API_KEY: '', JWT_SECRET: 'short' });
    expect(warnings).toEqual([
      'FRONTEND_URL is not set: links in emails (password resets, welcome emails) will point to http://localhost:5173.',
      'RESEND_API_KEY is not set: no email will be sent.',
      'JWT_SECRET is shorter than 32 characters: use a long random value.',
    ]);
  });
});
