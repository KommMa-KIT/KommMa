/**
 * PopularityStyling.test.ts
 *
 * Tests for the getPopularityStyle and getPopularityLabel pure utility functions.
 * Covers all known PopularityLevel values and the unknown/default fallback.
 */

import {
  getPopularityStyle,
  getPopularityLabel,
} from '../../components/measures/PopularityStyling';

// ─── getPopularityStyle ───────────────────────────────────────────────────────

describe('getPopularityStyle', () => {
  it('returns green classes for "hoch"', () => {
    const style = getPopularityStyle('hoch');
    expect(style).toContain('bg-green-100');
    expect(style).toContain('text-green-800');
    expect(style).toContain('border-green-300');
  });

  it('returns yellow classes for "mittel"', () => {
    const style = getPopularityStyle('mittel');
    expect(style).toContain('bg-yellow-100');
    expect(style).toContain('text-yellow-800');
    expect(style).toContain('border-yellow-300');
  });

  it('returns red classes for "niedrig"', () => {
    const style = getPopularityStyle('niedrig');
    expect(style).toContain('bg-red-100');
    expect(style).toContain('text-red-800');
    expect(style).toContain('border-red-300');
  });

  it('returns gray classes for an unknown value', () => {
    const style = getPopularityStyle('unknown' as any);
    expect(style).toContain('bg-gray-100');
    expect(style).toContain('text-gray-800');
    expect(style).toContain('border-gray-300');
  });

  it('returns gray classes for an empty string', () => {
    const style = getPopularityStyle('' as any);
    expect(style).toContain('bg-gray-100');
  });

  it('"hoch" style does not include yellow or red', () => {
    const style = getPopularityStyle('hoch');
    expect(style).not.toContain('yellow');
    expect(style).not.toContain('red');
  });

  it('"niedrig" style does not include green or yellow', () => {
    const style = getPopularityStyle('niedrig');
    expect(style).not.toContain('green');
    expect(style).not.toContain('yellow');
  });
});

// ─── getPopularityLabel ───────────────────────────────────────────────────────

describe('getPopularityLabel', () => {
  it('returns "Hohe Akzeptanz" for "hoch"', () => {
    expect(getPopularityLabel('hoch')).toBe('Hohe Akzeptanz');
  });

  it('returns "Mittlere Akzeptanz" for "mittel"', () => {
    expect(getPopularityLabel('mittel')).toBe('Mittlere Akzeptanz');
  });

  it('returns "Geringe Akzeptanz" for "niedrig"', () => {
    expect(getPopularityLabel('niedrig')).toBe('Geringe Akzeptanz');
  });

  it('returns "Unbekannte Akzeptanz" for an unknown value', () => {
    expect(getPopularityLabel('???' as any)).toBe('Unbekannte Akzeptanz');
  });

  it('returns "Unbekannte Akzeptanz" for an empty string', () => {
    expect(getPopularityLabel('' as any)).toBe('Unbekannte Akzeptanz');
  });

  it('each known level returns a distinct label', () => {
    const labels = [
      getPopularityLabel('hoch'),
      getPopularityLabel('mittel'),
      getPopularityLabel('niedrig'),
    ];
    expect(new Set(labels).size).toBe(3);
  });
});