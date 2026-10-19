import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, setCsrfToken } from './api-client';

function mockFetch(response: Response | Error) {
  const fn = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfToken(null);
});

describe('apiRequest', () => {
  it('sends the CSRF token on unsafe methods only, with credentials', async () => {
    setCsrfToken('csrf-123');
    const fetchMock = mockFetch(new Response(null, { status: 204 }));

    await apiRequest('/auth/logout', { method: 'POST' });
    await apiRequest('/auth/me').catch(() => undefined);

    const [, postInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [, getInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect((postInit.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-123');
    expect((getInit.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
    expect(postInit.credentials).toBe('include');
  });

  it('maps the API error envelope to ApiError', async () => {
    mockFetch(
      Response.json(
        { error: { code: 'EMAIL_TAKEN', message: 'Taken', details: ['x'] }, requestId: 'req-1' },
        { status: 409 },
      ),
    );
    const error = await apiRequest('/auth/register', { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'EMAIL_TAKEN',
      details: ['x'],
      requestId: 'req-1',
    });
  });

  it('reports network failures with a friendly message', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    await expect(apiRequest('/auth/me')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });
});
