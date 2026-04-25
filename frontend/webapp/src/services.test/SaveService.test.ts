import { saveService } from '../services/SaveService';
import { store } from '../store/store';

jest.mock('../store/store', () => ({
  store: {
    getState: jest.fn(),
    dispatch: jest.fn(),
  },
}));

describe('SaveService – additional coverage', () => {
  const fullCommunity = {
    communeKey: '123',
    communeName: 'Musterstadt',
    postalCode: '12345',
    selectedReferenceCommune: 'RefCommune',
    inputs: { f1: 10 },
    individual: { f1: true },
    sources: { f1: 'API' },
    subsidies: [{ id: 'solar', value: 100, unit: 'euro' }],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (store.getState as jest.Mock).mockReturnValue({ community: fullCommunity });
    global.URL.createObjectURL = jest.fn().mockReturnValue('mocked-url');
    global.URL.revokeObjectURL = jest.fn();
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();
  });

  // ─── downloadCurrent ───────────────────────────────────────────────────

  describe('downloadCurrent', () => {
    it('includes communeName in the filename', () => {
      const mockLink = { href: '', download: '', click: jest.fn() };
      document.createElement = jest.fn().mockReturnValue(mockLink as any);

      saveService.downloadCurrent();
      expect(mockLink.download).toContain('Musterstadt');
    });

    it('include todays date in the filename', () => {
      const mockLink = { href: '', download: '', click: jest.fn() };
      document.createElement = jest.fn().mockReturnValue(mockLink as any);
      const today = new Date().toISOString().split('T')[0];

      saveService.downloadCurrent();
      expect(mockLink.download).toContain(today);
    });

    it('creates a valid JSON blob containing inputs', () => {
      let capturedContent = '';
      const OriginalBlob = global.Blob;
      jest.spyOn(global, 'Blob').mockImplementationOnce((parts, opts) => {
        capturedContent = (parts as string[])[0];
        return new OriginalBlob(parts as BlobPart[], opts);
      });
      document.createElement = jest.fn().mockReturnValue({ href: '', download: '', click: jest.fn() } as any);

      saveService.downloadCurrent();

      const parsed = JSON.parse(capturedContent);
      expect(parsed.communeKey).toBe('123');
      expect(parsed.inputs.f1).toBe(10);
      expect(parsed.subsidies).toHaveLength(1);
    });

    it('uses "unbekannt" when communeName is null', () => {
      (store.getState as jest.Mock).mockReturnValue({
        community: { ...fullCommunity, communeName: null },
      });
      const mockLink = { href: '', download: '', click: jest.fn() };
      document.createElement = jest.fn().mockReturnValue(mockLink as any);

      saveService.downloadCurrent();
      expect(mockLink.download).toContain('unbekannt');
    });
  });

  // ─── hasData edge cases ────────────────────────────────────────────────

  describe('hasData', () => {
    it('returns true when only communeKey is set (no inputs, no subsidies)', () => {
      (store.getState as jest.Mock).mockReturnValue({
        community: { ...fullCommunity, inputs: {}, subsidies: [] },
      });
      expect(saveService.hasData()).toBe(true);
    });

    it('returns false when communeKey is null, inputs empty, subsidies empty', () => {
      (store.getState as jest.Mock).mockReturnValue({
        community: { communeKey: null, inputs: {}, subsidies: [] },
      });
      expect(saveService.hasData()).toBe(false);
    });
  });

  // ─── parseImport ─────────────────────────────────────────────────────

  describe('parseImport', () => {
    it('resolves with defaults for optional fields that are missing', async () => {
      const minimalData = {
        inputs: { f1: 1 },
        individual: {},
        sources: {},
      };
      const file = new File([JSON.stringify(minimalData)], 'test.json', { type: 'application/json' });
      const readerMock: any = { readAsText: jest.fn(), onload: null, onerror: null };
      (global as any).FileReader = jest.fn(() => readerMock);

      const promise = saveService.parseImport(file);
      readerMock.onload({ target: { result: JSON.stringify(minimalData) } });

      const result = await promise;
      expect(result.communeKey).toBeNull();
      expect(result.communeName).toBeNull();
      expect(result.postalCode).toBeNull();
      expect(result.selectedReferenceCommune).toBeNull();
      expect(result.subsidies).toEqual([]);
      expect(result.timestamp).toBeDefined();
    });

    it('rejects when inputs field is missing', async () => {
      const badData = { individual: {}, sources: {} };
      const file = new File([JSON.stringify(badData)], 'bad.json');
      const readerMock: any = { readAsText: jest.fn(), onload: null, onerror: null };
      (global as any).FileReader = jest.fn(() => readerMock);

      const promise = saveService.parseImport(file);
      readerMock.onload({ target: { result: JSON.stringify(badData) } });

      await expect(promise).rejects.toThrow('"inputs"');
    });

    it('rejects when individual field is missing', async () => {
      const badData = { inputs: {}, sources: {} };
      const file = new File([JSON.stringify(badData)], 'bad.json');
      const readerMock: any = { readAsText: jest.fn(), onload: null, onerror: null };
      (global as any).FileReader = jest.fn(() => readerMock);

      const promise = saveService.parseImport(file);
      readerMock.onload({ target: { result: JSON.stringify(badData) } });

      await expect(promise).rejects.toThrow('"individual"');
    });

    it('rejects when sources field is missing', async () => {
      const badData = { inputs: {}, individual: {} };
      const file = new File([JSON.stringify(badData)], 'bad.json');
      const readerMock: any = { readAsText: jest.fn(), onload: null, onerror: null };
      (global as any).FileReader = jest.fn(() => readerMock);

      const promise = saveService.parseImport(file);
      readerMock.onload({ target: { result: JSON.stringify(badData) } });

      await expect(promise).rejects.toThrow('"sources"');
    });

    it('rejects with generic error when a non-Error is caught during parsing', async () => {
      const file = new File(['{}'], 'test.json');
      const readerMock: any = { readAsText: jest.fn(), onload: null, onerror: null };
      (global as any).FileReader = jest.fn(() => readerMock);

      // Override JSON.parse to throw a non-Error
      const origParse = JSON.parse;
      jest.spyOn(JSON, 'parse').mockImplementationOnce(() => { throw 'not an Error object'; });

      const promise = saveService.parseImport(file);
      readerMock.onload({ target: { result: '{}' } });

      await expect(promise).rejects.toThrow('Unbekannter Fehler');
      JSON.parse = origParse;
    });

    it('rejects when the data is not an object (e.g. a string)', async () => {
      const file = new File(['"just a string"'], 'test.json');
      const readerMock: any = { readAsText: jest.fn(), onload: null, onerror: null };
      (global as any).FileReader = jest.fn(() => readerMock);

      const promise = saveService.parseImport(file);
      readerMock.onload({ target: { result: '"just a string"' } });

      await expect(promise).rejects.toThrow('Ungültiges Dateiformat');
    });
  });
});
