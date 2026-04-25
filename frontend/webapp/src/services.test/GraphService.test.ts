import { graphService } from '../services/GraphService';
import { API_BASE_URL } from '../config';

describe('GraphService – additional coverage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls the correct URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    } as any);
    await graphService.fetchGraph();
    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/results/graph`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('returns an empty array when backend returns []', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    } as any);
    expect(await graphService.fetchGraph()).toEqual([]);
  });

  it('includes status and statusText in error message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as any);
    await expect(graphService.fetchGraph()).rejects.toThrow('404');
  });
});