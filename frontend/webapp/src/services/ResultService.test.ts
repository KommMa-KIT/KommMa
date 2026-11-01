import { resultService } from './ResultService';
import { API_BASE_URL } from '../config';

describe('ResultService – additional coverage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('sends the full serialised payload as JSON body', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({}) } as any);
    const payload = { inputs: [{ id: 'f1', value: 10, individual: true }], subsidies: [] };
    const response = await resultService.calculateResult(payload);
    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/results/calculate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(response).toEqual({});
  });

  it('propagates HTTP status in error message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
    } as any);
    await expect(resultService.calculateResult({})).rejects.toThrow('422 Unprocessable Entity');
  });

  it('propagates network-level errors unchanged', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('DNS failure'));
    await expect(resultService.calculateResult({})).rejects.toThrow('DNS failure');
  });
});