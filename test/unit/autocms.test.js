// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { autocms } from '../../src/auto.js';
import { flushSync } from '../../src/index.js';

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  document.body.removeAttribute('data-mode-editing');
  localStorage.clear();
});

describe('autocms', () => {
  it('scans data-edit, publishes to localStorage, and tears down cleanly', async () => {
    document.body.innerHTML = `<h1 data-edit="headline">Hello</h1>`;

    const api = await autocms({ gate: 'always', storageKey: 'test:cms' });

    // Signal created from HTML text
    expect(api.signals.headline.get()).toBe('Hello');

    // CMS bar is up
    const bar = document.querySelector('.rui-cms-bar');
    expect(bar).not.toBeNull();

    // Edit the text
    api.editing.set('on');
    flushSync();
    const h1 = document.querySelector('h1');
    h1.textContent = 'World';
    h1.dispatchEvent(new Event('input'));
    flushSync();
    expect(api.signals.headline.get()).toBe('World');
    expect(api.draft.dirty.get()).toBe(true);

    // Publish → localStorage
    await api.draft.save();
    const stored = JSON.parse(localStorage.getItem('test:cms'));
    expect(stored.snapshot.headline).toBe('World');
    expect(api.draft.dirty.get()).toBe(false);

    // Teardown: bar, styles, badge, body attribute all gone
    api.dispose();
    expect(document.querySelector('.rui-cms-bar')).toBeNull();
    expect(document.querySelector('.rui-mode-badge')).toBeNull();
    expect(document.body.hasAttribute('data-mode-editing')).toBe(false);
  });

  it('loads a persisted snapshot over HTML defaults', async () => {
    localStorage.setItem('test:cms2', JSON.stringify({
      snapshot: { headline: 'Saved' },
      version: '3',
    }));
    document.body.innerHTML = `<h1 data-edit="headline">Default</h1>`;

    const api = await autocms({ gate: 'always', storageKey: 'test:cms2' });

    expect(api.signals.headline.get()).toBe('Saved');
    flushSync();
    expect(document.querySelector('h1').textContent).toBe('Saved');
    expect(api.draft.version).toBe('3');

    api.dispose();
  });

  it('reverts edits on discard', async () => {
    document.body.innerHTML = `<p data-edit="body">Original</p>`;

    const api = await autocms({ gate: 'always', storageKey: 'test:cms3' });
    api.signals.body.set('Changed');
    flushSync();
    expect(api.draft.dirty.get()).toBe(true);

    api.draft.discard();
    flushSync();
    expect(api.signals.body.get()).toBe('Original');
    expect(document.querySelector('p').textContent).toBe('Original');

    api.dispose();
  });

  it('renders data-edit-list items from a template', async () => {
    document.body.innerHTML = `
      <ul data-edit-list="items">
        <template><li><span data-field="label"></span></li></template>
      </ul>`;

    const api = await autocms({ gate: 'always', storageKey: 'test:cms4' });
    flushSync();

    // Empty initial list renders nothing but is wired
    expect(Array.isArray(api.signals.items.get())).toBe(true);

    // Add an item through the signal — row appears in the DOM
    api.signals.items.update((a) => [...a, { id: 1, label: 'First' }]);
    flushSync();
    expect(document.querySelectorAll('li').length).toBe(1);
    expect(document.querySelector('[data-field="label"]').textContent).toBe('First');

    api.dispose();
  });

  it('data-edit-input is locked for visitors and live in edit mode', async () => {
    document.body.innerHTML = `<input type="range" min="0" max="360" value="250" data-edit-input="hue" data-css-var="--hue">`;

    const api = await autocms({ gate: 'always', storageKey: 'test:cms6' });
    flushSync();
    const input = document.querySelector('input');

    // Visitor: locked, input events ignored
    expect(input.classList.contains('rui-locked')).toBe(true);
    input.value = '100';
    input.dispatchEvent(new Event('input'));
    flushSync();
    expect(api.signals.hue.get()).toBe(250);

    // Admin: edit mode unlocks, value is captured (and would publish)
    api.editing.set('on');
    flushSync();
    expect(input.classList.contains('rui-locked')).toBe(false);
    input.value = '100';
    input.dispatchEvent(new Event('input'));
    flushSync();
    expect(api.signals.hue.get()).toBe(100);
    expect(document.documentElement.style.getPropertyValue('--hue')).toBe('100');

    api.dispose();
  });

  it('respects gate=hash — no CMS bar without #edit', async () => {
    document.body.innerHTML = `<h1 data-edit="headline">Hello</h1>`;
    const api = await autocms({ gate: 'hash', storageKey: 'test:cms5' });
    expect(document.querySelector('.rui-cms-bar')).toBeNull();
    api.dispose();
  });

  it('remote adapter without token: bar shows key field, publish is guarded', async () => {
    document.body.innerHTML = `<h1 data-edit="headline">Hello</h1>`;

    // Stub fetch so the suite stays hermetic — the github load() must not hit the network.
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    const api = await autocms({
      gate: 'always',
      storageKey: 'test:cms7',
      adapter: 'github',
      ghOwner: 'me', ghRepo: 'site', ghPath: 'c.json',
      // no ghToken — must not throw
    });

    const bar = document.querySelector('.rui-cms-bar');
    const tokenInput = bar.querySelector('.b-token-input');
    expect(tokenInput).not.toBeNull();

    // Publish guard: no token → save() never fires, status stays idle, field flashes
    api.signals.headline.set('Changed');
    flushSync();
    bar.querySelector('.b-publish').click();
    flushSync();
    expect(api.draft.status.get()).toBe('idle');
    expect(bar.querySelector('.b-token').classList.contains('flash')).toBe(true);

    // Enter the token via the bar → stored locally under the namespaced key
    tokenInput.value = 'ghp_secret';
    tokenInput.closest('.b-token').querySelector('button').click();
    expect(localStorage.getItem('test:cms7:token')).toBe('ghp_secret');

    // Token field collapses to the saved state
    expect(tokenInput.style.display).toBe('none');

    api.dispose();
    globalThis.fetch = realFetch;
  });

  it('local adapter: no token field in the bar', async () => {
    document.body.innerHTML = `<h1 data-edit="headline">Hello</h1>`;
    const api = await autocms({ gate: 'always', storageKey: 'test:cms8' });
    expect(document.querySelector('.b-token-input')).toBeNull();
    api.dispose();
  });
});
