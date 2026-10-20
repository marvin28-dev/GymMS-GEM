// The helpers every print window relies on to keep typed text from running as
// page code (F-085).
import { describe, it, expect } from 'vitest';
import { escapeHtml, safeImageSrc } from '../../gem-frontend/src/utils/receipt.js';

describe('escapeHtml', () => {
  it('turns markup into text', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('escapes ampersands and single quotes', () => {
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
  });

  it('prints nothing for missing values and keeps numbers', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(15000)).toBe('15000');
  });
});

describe('safeImageSrc', () => {
  it('keeps web addresses and embedded pictures', () => {
    expect(safeImageSrc('https://res.cloudinary.com/gem/receipt.png')).toBe('https://res.cloudinary.com/gem/receipt.png');
    expect(safeImageSrc('http://example.test/a.jpg')).toBe('http://example.test/a.jpg');
    expect(safeImageSrc('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('drops anything that could run as code', () => {
    expect(safeImageSrc('javascript:alert(1)')).toBe('');
    expect(safeImageSrc('data:text/html;base64,PHNjcmlwdD4=')).toBe('');
    expect(safeImageSrc('data:image/svg+xml;base64,PHN2Zz4=')).toBe('');
    expect(safeImageSrc('x" onerror="alert(1)')).toBe('');
  });

  it('drops missing values', () => {
    expect(safeImageSrc(null)).toBe('');
    expect(safeImageSrc('')).toBe('');
  });
});
