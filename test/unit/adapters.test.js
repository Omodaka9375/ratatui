import { describe, it, expect, vi } from 'vitest';
import { restAdapter, githubAdapter, cfAdapter, ipfsAdapter } from '../../src/adapters.js';

// Minimal Response-like stub
const res = (status, body = {}, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  headers: { get: (k) => headers[k] ?? null },
});

describe('TokenSource: lazy token resolution', () => {
  it('restAdapter resolves a function token per request and omits it when null', async () => {
    let token = null;
    const fetchImpl = vi.fn().mockResolvedValue(res(200, {}, { ETag: 'v1' }));
    const adapter = restAdapter('https://api.example.com/x', { fetchImpl, token: () => token });

    await adapter.persist({ a: 1 }, { version: null, label: 't' });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();

    token = 'secret-123';
    await adapter.persist({ a: 2 }, { version: null, label: 't' });
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer secret-123');
  });

  it('restAdapter accepts a static token string', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, {}, { ETag: 'v1' }));
    const adapter = restAdapter('https://api.example.com/x', { fetchImpl, token: 'static-tok' });

    await adapter.load();
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer static-tok');
  });

  it('githubAdapter works without a token (public repo reads) and adds it when set', async () => {
    let token = null;
    const content = btoa(JSON.stringify({ title: 'Hi' }));
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { content, sha: 'abc' }));
    const adapter = githubAdapter({
      owner: 'me', repo: 'site', path: 'c.json', token: () => token, fetchImpl,
    });

    await adapter.load();
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();

    token = 'ghp_later';
    await adapter.load();
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer ghp_later');
  });

  it('cfAdapter resolves token lazily', async () => {
    let token = 't1';
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { snapshot: {}, version: '1' }));
    const adapter = cfAdapter('https://w.workers.dev/c', { fetchImpl, token: () => token });

    await adapter.load();
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer t1');

    token = null;
    await adapter.load();
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it('ipfsAdapter resolves token lazily on pin and pointer calls', async () => {
    let token = null;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(200, { cid: 'bafy1' }))  // pin
      .mockResolvedValueOnce(res(200, {}));                // pointer update
    const adapter = ipfsAdapter({
      pinEndpoint: 'https://pin.example.com/pin',
      pointerUrl: 'https://pin.example.com/pointer',
      token: () => token,
      fetchImpl,
    });

    token = 'pin-key';
    await adapter.persist({ a: 1 }, { version: null, label: 't' });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer pin-key');
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer pin-key');
  });
});
