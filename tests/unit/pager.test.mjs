// F-119: every page of a long list can be reached by its number.
import { describe, it, expect } from 'vitest';
import { pageNumbers } from '../../gem-frontend/src/utils/pager.js';

describe('pageNumbers', () => {
  it('numbers every page while there are few', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(7, 4)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the first, the last and the pages around the current one', () => {
    expect(pageNumbers(12, 1)).toEqual([1, 2, '…', 12]);
    expect(pageNumbers(12, 6)).toEqual([1, '…', 5, 6, 7, '…', 12]);
    expect(pageNumbers(12, 12)).toEqual([1, '…', 11, 12]);
  });

  it('reaches pages past the fifth', () => {
    expect(pageNumbers(9, 8)).toContain(8);
    expect(pageNumbers(9, 8)).toContain(9);
  });
});
