import { describe, it, expect, vi } from 'vitest';
import * as core from '../../src/index.js';

describe('Core Hardening: Error Boundaries', () => {
  it('bind: should catch and log errors in transform, not crash the app', () => {
    const { bind, knob } = core;
    const s1 = knob(10);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // This transform will throw every time
    bind(s1, () => { throw new Error('Intentional crash'); }, (v) => {}, 'error-bound-wire');
    
    s1.set(20);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[RatatUI] Binding error [error-bound-wire]:')
    );
    consoleSpy.mockRestore();
  });

  it('derive: should handle initial transform errors gracefully', () => {
    const { derive, knob } = core;
    const s1 = knob(10);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Initial transform fails
    const d = derive(s1, () => { throw new Error('Initial Fail'); }, 'failed-derive');

    // Should initialize with undefined rather than throwing
    expect(d.get()).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[RatatUI] Derive compute error [failed-derive]:'),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});

describe('Error Handler Hook', () => {
  it('setErrorHandler receives binding errors with context', () => {
    const { bind, knob, setErrorHandler } = core;
    const s1 = knob(1);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const received = [];
    setErrorHandler((err, ctx) => received.push({ err, ctx }));

    bind(s1, () => { throw new Error('boom'); }, () => {}, 'boom-bind');

    expect(received.length).toBe(1);
    expect(received[0].err.message).toBe('boom');
    expect(received[0].ctx).toEqual({ label: 'boom-bind', phase: 'binding' });

    setErrorHandler(null);
    consoleSpy.mockRestore();
  });

  it('swallows errors thrown by the handler itself', () => {
    const { bind, knob, setErrorHandler } = core;
    const s1 = knob(1);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setErrorHandler(() => { throw new Error('handler exploded'); });

    // Should not throw despite the broken handler
    bind(s1, () => { throw new Error('original'); }, () => {}, 'safe-bind');

    setErrorHandler(null);
    consoleSpy.mockRestore();
  });
});

describe('Adapter Hardening: Mocking', () => {
  it('restAdapter: should handle 409 Conflict correctly', async () => {
    const { restAdapter } = core;
    const mockFetch = vi.fn();
    
    // Mock a 409 Conflict response
    // We use a real function for json() to ensure it works with .catch() logic in src
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Map([['ETag', 'new-etag']]),
      json: async () => ({ snapshot: { data: 'server-version' } })
    });

    const adapter = restAdapter('http://api.com', { fetchImpl: mockFetch });
    
    try {
      await adapter.persist({ data: 'my-version' }, { version: 'old-etag' });
    } catch (e) {
      // Should be caught as CommitConflict
      expect(e.constructor.name).toBe('CommitConflict');
      expect(e.serverSnapshot).toEqual({ snapshot: { data: 'server-version' } });
      expect(e.serverVersion).toBe('new-etag');
    }
  });
});
