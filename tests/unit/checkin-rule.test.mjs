// F-114: one photo rule for every check-in button. With no photo to check by
// sight, the person gives their check-in code first, member or visitor alike.
import { describe, it, expect } from 'vitest';
import { needsCheckInCode } from '../../gem-frontend/src/utils/checkin.js';

describe('needsCheckInCode', () => {
  it('asks a member without a photo for the code', () => {
    expect(needsCheckInCode({ isVisitor: false, photo: null })).toBe(true);
  });

  it('asks a visitor without a photo for the code', () => {
    expect(needsCheckInCode({ isVisitor: true, status: 'visitor', photo: '' })).toBe(true);
  });

  it('lets anyone with a photo straight in, visitors included', () => {
    expect(needsCheckInCode({ isVisitor: false, photo: 'https://res.cloudinary.test/a.png' })).toBe(false);
    expect(needsCheckInCode({ isVisitor: true, photo: 'https://res.cloudinary.test/b.png' })).toBe(false);
  });

  it('does not ask again someone found by typing that code', () => {
    expect(needsCheckInCode({ photo: null }, { foundByCode: true })).toBe(false);
  });
});
