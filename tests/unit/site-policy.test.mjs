// D-45: the site sent no security headers. The page's content policy is built
// into the page from the API's address; the rest are Vercel headers.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contentPolicy } from '../../gem-frontend/vite.config.js';

const vercel = JSON.parse(readFileSync(new URL('../../gem-frontend/vercel.json', import.meta.url), 'utf8'));
const headers = Object.fromEntries(vercel.headers.find(h => h.source === '/(.*)').headers.map(h => [h.key, h.value]));
const directive = (policy, name) => policy.split(';').map(d => d.trim()).find(d => d.startsWith(`${name} `)) || '';

describe("the page's content policy", () => {
  const policy = contentPolicy('https://gem-api.up.railway.app/api');

  it('lets the page talk to its own API and the photo store, and nothing else', () => {
    expect(directive(policy, 'connect-src')).toBe("connect-src 'self' https://gem-api.up.railway.app https://res.cloudinary.com");
    expect(directive(policy, 'default-src')).toBe("default-src 'self'");
  });

  it('runs only the app\'s own scripts', () => {
    expect(directive(policy, 'script-src')).toBe("script-src 'self'");
    expect(policy).not.toMatch(/unsafe-eval/);
  });

  it('shows photos from the photo store and fonts from Google Fonts', () => {
    expect(directive(policy, 'img-src')).toContain('https://res.cloudinary.com');
    expect(directive(policy, 'font-src')).toContain('https://fonts.gstatic.com');
    expect(directive(policy, 'object-src')).toBe("object-src 'none'");
  });

  it('leaves the API out when its address is not a URL, instead of breaking the policy', () => {
    expect(directive(contentPolicy('not a url'), 'connect-src')).toBe("connect-src 'self' https://res.cloudinary.com");
  });

  it('follows the photo store when it has another address', () => {
    const own = contentPolicy('https://api.example.test/api', 'https://photos.example.test/gem');
    expect(directive(own, 'img-src')).toBe("img-src 'self' data: blob: https://photos.example.test");
    expect(directive(own, 'connect-src')).toBe("connect-src 'self' https://api.example.test https://photos.example.test");
  });
});

describe("the site's headers", () => {
  it('stop the site being framed, sniffed or reached over plain http', () => {
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=\d{8,}/);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('let the page use the camera (check-in photos) and nothing else of the device', () => {
    expect(headers['Permissions-Policy']).toContain('camera=(self)');
    expect(headers['Permissions-Policy']).toContain('microphone=()');
    expect(headers['Permissions-Policy']).toContain('geolocation=()');
  });

  it('still send every address to the app', () => {
    expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
  });
});
