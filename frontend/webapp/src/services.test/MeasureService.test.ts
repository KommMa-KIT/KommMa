import { measureService } from '../services/MeasureService';
import { Measure } from '../types/measureTypes';

describe('MeasureService – additional coverage', () => {
  const mockMeasures: Measure[] = [
    { id: '1', title: 'Solar', shortDescription: 'Solar kurz', description: 'Solar lang', popularity: 'high', popularityComment: '' },
    { id: '2', title: 'Wind', shortDescription: 'Wind kurz', description: 'Wind lang', popularity: 'low', popularityComment: '' },
  ];

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('fetchMeasures', () => {
    it('returns empty array from backend', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue([]) } as any);
      expect(await measureService.fetchMeasures()).toEqual([]);
    });

    it('throws wrapped error when response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' } as any);
      await expect(measureService.fetchMeasures()).rejects.toThrow('Unknown error occured when attempting to fetch measures.');
    });

    it('throws wrapped error on network failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));
      await expect(measureService.fetchMeasures()).rejects.toThrow('Unknown error occured when attempting to fetch measures.');
    });
  });

  describe('searchMeasures', () => {
    it('returns empty array when measures list is empty', () => {
      expect(measureService.searchMeasures([], 'solar')).toEqual([]);
    });

    it('matches by shortDescription (case-insensitive)', () => {
      const result = measureService.searchMeasures(mockMeasures, 'WIND KURZ');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('matches by description', () => {
      const result = measureService.searchMeasures(mockMeasures, 'solar lang');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('returns multiple matches', () => {
      // Both have "kurz" in shortDescription
      const result = measureService.searchMeasures(mockMeasures, 'kurz');
      expect(result).toHaveLength(2);
    });

    it('trims the query before matching', () => {
      const result = measureService.searchMeasures(mockMeasures, '  Solar  ');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });
});