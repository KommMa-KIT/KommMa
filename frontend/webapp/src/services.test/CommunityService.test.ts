import communityService from '../services/CommunityService';

describe('CommunityService', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------
  // getCommuneInfoByKey
  // ---------------------------------------------
  describe('getCommuneInfoByKey', () => {
    it('returns commune info when response is ok', async () => {
      const mockData = { name: 'Berlin' };
      mockFetch.mockResolvedValue({ ok: true, json: async () => mockData });

      const result = await communityService.getCommuneInfoByKey('123');

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/communes/info_by_key/123'));
      expect(result).toEqual(mockData);
    });

    it('throws error when response is not ok', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      await expect(communityService.getCommuneInfoByKey('123')).rejects.toThrow('Gemeinde nicht gefunden');
    });

    it('calls the correct URL with the given key', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
      await communityService.getCommuneInfoByKey('08111000');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/communes/info_by_key/08111000'));
    });
  });

  // ---------------------------------------------
  // getCommuneInfoByCode
  // ---------------------------------------------
  describe('getCommuneInfoByCode', () => {
    it('returns commune info when response is ok', async () => {
      const mockData = { name: 'Hamburg', key: '02000000', postal_code: '20095' };
      mockFetch.mockResolvedValue({ ok: true, json: async () => mockData });

      const result = await communityService.getCommuneInfoByCode('20095');

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/communes/info_by_code/20095'));
      expect(result).toEqual(mockData);
    });

    it('throws error when response is not ok', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      await expect(communityService.getCommuneInfoByCode('99999')).rejects.toThrow('Gemeinde nicht gefunden');
    });
  });

  // ---------------------------------------------
  // searchCommunes
  // ---------------------------------------------
  describe('searchCommunes', () => {
    it('encodes query correctly and returns results', async () => {
      const mockData = [{ name: 'München' }];
      mockFetch.mockResolvedValue({ ok: true, json: async () => mockData });

      const result = await communityService.searchCommunes('München Süd');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/communes/search?q=M%C3%BCnchen%20S%C3%BCd')
      );
      expect(result).toEqual(mockData);
    });

    it('throws error if search fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      await expect(communityService.searchCommunes('Test')).rejects.toThrow('Suche fehlgeschlagen');
    });

    it('returns an empty array when backend returns []', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const result = await communityService.searchCommunes('Unbekannt');
      expect(result).toEqual([]);
    });

    it('encodes special characters in query', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
      await communityService.searchCommunes('Bad Tölz & Umgebung');
      const calledUrl = (fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('q=');
      expect(calledUrl).not.toContain(' ');
      expect(calledUrl).not.toContain('&Umgebung'); // & must be encoded
    });
  });

  // ---------------------------------------------
  // getPrefillData (inkl. Mapping-Test)
  // ---------------------------------------------
  describe('getPrefillData', () => {
    it('maps array data to PrefillData structure', async () => {
      const backendArray = [
        { id: 'field1', value: 10, source: 'test', date: '2024', individual: false },
      ];
      mockFetch.mockResolvedValue({ ok: true, json: async () => backendArray });

      const result = await communityService.getPrefillData('123');

      expect(result).toEqual({
        field1: { value: 10, source: 'test', date: '2024', individual: false },
      });
    });

    it('maps multiple items correctly', async () => {
      const backendArray = [
        { id: 'a', value: 1, source: 'src1', date: '2024', individual: true },
        { id: 'b', value: 2, source: 'src2', date: '2023', individual: false },
      ];
      mockFetch.mockResolvedValue({ ok: true, json: async () => backendArray });

      const result = await communityService.getPrefillData('456');
      expect(Object.keys(result)).toHaveLength(2);
      expect(result['a'].value).toBe(1);
      expect(result['b'].individual).toBe(false);
    });

    it('skips items without an id', async () => {
      const backendArray = [
        { value: 99, source: 'x' }, // no id
        { id: 'validField', value: 5, source: 'y', date: '2024', individual: false },
      ];
      mockFetch.mockResolvedValue({ ok: true, json: async () => backendArray });

      const result = await communityService.getPrefillData('789');
      expect(Object.keys(result)).toHaveLength(1);
      expect(result['validField']).toBeDefined();
    });

    it('returns empty object for invalid backend data (null)', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => null });
      const result = await communityService.getPrefillData('123');
      expect(result).toEqual({});
    });

    it('returns empty object when backend returns empty array', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
      const result = await communityService.getPrefillData('123');
      expect(result).toEqual({});
    });

    it('throws error if prefill fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(communityService.getPrefillData('123')).rejects.toThrow('Prefill failed!');
    });

    it('calls the correct prefill URL', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
      await communityService.getPrefillData('ABC123');
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/communes/ABC123/prefill'));
    });
  });

  // ---------------------------------------------
  // getAverageData
  // ---------------------------------------------
  describe('getAverageData', () => {
    it('returns mapped PrefillData on success', async () => {
      const backendArray = [
        { id: 'avgField', value: 42, source: 'Statistik', date: '2024', individual: false },
      ];
      mockFetch.mockResolvedValue({ ok: true, json: async () => backendArray });

      const result = await communityService.getAverageData();

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/communes/average'));
      expect(result['avgField'].value).toBe(42);
    });

    it('returns empty object when backend returns empty array', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
      const result = await communityService.getAverageData();
      expect(result).toEqual({});
    });

    it('throws error if request fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(communityService.getAverageData()).rejects.toThrow('Average values are not available!');
    });
  });

  // ---------------------------------------------
  // getReferenceCommunesList
  // ---------------------------------------------
  describe('getReferenceCommunesList', () => {
    it('returns list of reference commune previews on success', async () => {
      const mockList = [{ id: '1', name: 'Ref A' }, { id: '2', name: 'Ref B' }];
      mockFetch.mockResolvedValue({ ok: true, json: async () => mockList });

      const result = await communityService.getReferenceCommunesList();

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/reference-communes/list'));
      expect(result).toEqual(mockList);
    });

    it('returns empty array when backend returns []', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
      const result = await communityService.getReferenceCommunesList();
      expect(result).toEqual([]);
    });

    it('throws error if request fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(communityService.getReferenceCommunesList()).rejects.toThrow(
        'Reference communes are not available!'
      );
    });
  });

  // ---------------------------------------------
  // getReferenceCommune
  // ---------------------------------------------
  describe('getReferenceCommune', () => {
    it('returns the reference commune for a given id', async () => {
      const mockCommune = { id: 'ref-1', name: 'Musterkommune', inputs: [] };
      mockFetch.mockResolvedValue({ ok: true, json: async () => mockCommune });

      const result = await communityService.getReferenceCommune('ref-1');

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/reference-communes/ref-1'));
      expect(result).toEqual(mockCommune);
    });

    it('throws error with id in message if request fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(communityService.getReferenceCommune('ref-99')).rejects.toThrow(
        'Reference commune ref-99 is not available!'
      );
    });
  });

  // ---------------------------------------------
  // getInputParameters (Category Mapping)
  // ---------------------------------------------
  describe('getInputParameters', () => {
    it('maps all known backend categories correctly', async () => {
      const backendData = {
        Allgemein: [{ id: '1' }],
        Energie:   [{ id: '2' }],
        Mobilität: [{ id: '3' }],
        Wasser:    [{ id: '4' }],
      };
      mockFetch.mockResolvedValue({ ok: true, json: async () => backendData });

      const result = await communityService.getInputParameters();

      expect(result).toEqual({
        General:  [{ id: '1' }],
        Energy:   [{ id: '2' }],
        Mobility: [{ id: '3' }],
        Water:    [{ id: '4' }],
      });
    });

    it('maps backend categories correctly and warns for unknown ones', async () => {
      const backendData = {
        Allgemein: [{ id: '1' }],
        Energie:   [{ id: '2' }],
        Unbekannt: [{ id: '3' }],
      };
      mockFetch.mockResolvedValue({ ok: true, json: async () => backendData });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await communityService.getInputParameters();

      expect(result).toEqual({ General: [{ id: '1' }], Energy: [{ id: '2' }] });
      expect(warnSpy).toHaveBeenCalledWith('Unbekannte Kategorie vom Backend: Unbekannt');
      expect(result).not.toHaveProperty('Unbekannt');

      warnSpy.mockRestore();
    });

    it('warns for every unknown category separately', async () => {
      const backendData = { X: [], Y: [] };
      mockFetch.mockResolvedValue({ ok: true, json: async () => backendData });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await communityService.getInputParameters();

      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith('Unbekannte Kategorie vom Backend: X');
      expect(warnSpy).toHaveBeenCalledWith('Unbekannte Kategorie vom Backend: Y');

      warnSpy.mockRestore();
    });

    it('returns empty object when backend returns empty categories', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
      const result = await communityService.getInputParameters();
      expect(result).toEqual({});
    });

    it('throws error if request fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(communityService.getInputParameters()).rejects.toThrow(
        'Input parameters are not available!'
      );
    });
  });

  // ---------------------------------------------
  // getSubsidyCategories
  // ---------------------------------------------
  describe('getSubsidyCategories', () => {
    it('returns subsidy categories on success', async () => {
      const mockCategories = [{ id: 'solar', label: 'Solarenergie' }];
      mockFetch.mockResolvedValue({ ok: true, json: async () => mockCategories });

      const result = await communityService.getSubsidyCategories();

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/inputs/subsidies'));
      expect(result).toEqual(mockCategories);
    });

    it('returns empty array when no categories exist', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
      const result = await communityService.getSubsidyCategories();
      expect(result).toEqual([]);
    });

    it('throws error if request fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(communityService.getSubsidyCategories()).rejects.toThrow(
        'Subsidy categories not available'
      );
    });
  });

  // ---------------------------------------------
  // validateImport
  // ---------------------------------------------
  describe('validateImport', () => {
    it('sends POST request with correct body', async () => {
      const requestData = { test: true };
      const responseData = { valid: true };
      mockFetch.mockResolvedValue({ ok: true, json: async () => responseData });

      const result = await communityService.validateImport(requestData as any);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/inputs/import'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        })
      );
      expect(result).toEqual(responseData);
    });

    it('serializes complex request data correctly', async () => {
      const requestData = { fields: [{ id: 'f1', value: 99 }], communeKey: 'ABC' };
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

      await communityService.validateImport(requestData as any);

      const callBody = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.fields[0].value).toBe(99);
      expect(callBody.communeKey).toBe('ABC');
    });

    it('throws error if validation fails', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(communityService.validateImport({} as any)).rejects.toThrow('Import-Validation failed');
    });
  });
});