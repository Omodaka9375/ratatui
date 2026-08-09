import { describe, it, expect, vi } from 'vitest';
import { restAdapter, githubAdapter, cfAdapter, pinataAdapter } from '../../src/adapters.js';

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

  it('pinataAdapter uploads via v3 multipart and resolves the JWT lazily', async () => {
    let token = null;
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { data: { cid: 'bafy1' } }));
    const adapter = pinataAdapter({ name: 'home', jwt: () => token, fetchImpl });

    token = 'jwt-abc';
    const out = await adapter.persist({ a: 1 }, { version: null, label: 't' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://uploads.pinata.cloud/v3/files');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-abc');
    expect(init.body).toBeInstanceOf(FormData); // multipart, no manual Content-Type
    expect(out.version).toBe('bafy1');
  });

  it('pinataAdapter loads latest file by name then reads the CID from the gateway', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(200, { data: { files: [{ cid: 'bafyX' }] } })) // list
      .mockResolvedValueOnce(res(200, { title: 'Hi' }));                          // gateway read
    const adapter = pinataAdapter({ name: 'home', jwt: 'jwt', fetchImpl });

    const got = await adapter.load();
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.pinata.cloud/v3/files/public?name=home&order=DESC&limit=1');
    expect(fetchImpl.mock.calls[1][0]).toBe('https://gateway.pinata.cloud/ipfs/bafyX');
    expect(got.snapshot).toEqual({ title: 'Hi' });
    expect(got.version).toBe('bafyX');
  });

  it('pinataAdapter returns null when no file matches the name', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { data: { files: [] } }));
    const adapter = pinataAdapter({ name: 'missing', jwt: 'jwt', fetchImpl });
    expect(await adapter.load()).toBeNull();
  });
});
