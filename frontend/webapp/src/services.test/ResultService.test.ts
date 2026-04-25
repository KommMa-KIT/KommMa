import { resultService } from '../services/ResultService';

describe('ResultService – additional coverage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('sends the full serialised payload as JSON body', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({}) } as any);
    const payload = { inputs: [{ id: 'f1', value: 10, individual: true }], subsidies: [] };
    await resultService.calculateResult(payload);
    const callBody = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody.inputs[0].id).toBe('f1');
    expect(callBody.inputs[0].value).toBe(10);
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