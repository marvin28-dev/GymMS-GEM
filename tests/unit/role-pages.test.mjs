// F-087: every role gets the pages it should, older roles included, and a role
// the app does not know gets only its own record (never the owner's everything).
import { describe, it, expect } from 'vitest';
import { pagesFor, hasNavigation } from '../../gem-frontend/src/utils/rolePages.js';

describe('pagesFor', () => {
  it('gives the owner every page', () => {
    expect(pagesFor('general_manager').pages).toBeNull();
  });

  it('treats instructors and coaches as trainers, Members included', () => {
    expect(pagesFor('instructor').pages).toEqual(pagesFor('trainer').pages);
    expect(pagesFor('coach').pages).toEqual(pagesFor('trainer').pages);
    expect(pagesFor('instructor').pages).toContain('members');
  });

  it('gives an unknown or missing role its own record only (and Help & support)', () => {
    for (const role of ['accountant', '', null, undefined, 'something-new']) {
      expect(pagesFor(role).pages).toEqual(['my-profile', 'notifications', 'support']);
      expect(hasNavigation(role)).toBe(false);
    }
  });

  // The owner, 7 November 2026: anyone signed in can tell GEM something is wrong
  it('lets every role open Help & support', () => {
    for (const role of ['manager', 'front_desk', 'trainer', 'instructor', 'coach', 'other', 'accountant']) {
      expect(pagesFor(role).pages, role).toContain('support');
    }
    expect(hasNavigation('other')).toBe(false);
  });
});
