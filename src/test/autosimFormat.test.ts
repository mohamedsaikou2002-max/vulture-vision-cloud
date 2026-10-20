import { describe, expect, it } from 'vitest';
import { pct, signedPct } from '../lib/autosimFormat';

describe('percentage formatting for simulator numbers', () => {
  it('renders 0-1 model values as percentages', () => {
    expect(pct(0.1234)).toBe('12.3%');
    expect(pct(0.5, 0)).toBe('50%');
    expect(pct(0)).toBe('0.0%');
    expect(pct(1)).toBe('100.0%');
    expect(pct(-0.04, 0)).toBe('-4%');
  });
  it('signs deltas and handles missing values', () => {
    expect(signedPct(0.012)).toBe('+1.2%');
    expect(signedPct(-0.05, 0)).toBe('-5%');
    expect(signedPct(0, 0)).toBe('0%');
    expect(pct(null)).toBe('—');
    expect(pct(undefined)).toBe('—');
    expect(signedPct(NaN)).toBe('—');
  });
});
