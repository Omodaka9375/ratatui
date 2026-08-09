// @vitest-environment happy-dom
// Loads the REAL demo.html markup + the REAL built CDN bundle, and drives the
// page exactly as a browser would: autocms() runs, signals get created, edits
// flow, theme/hue/align controls work, persistence round-trips.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const demoHtml = readFileSync(resolve(here, '../../index.html'), 'utf8');

// pull out the <body> markup (script tags stripped — we drive the lib directly)
// and the <body> tag's own attributes (data-theme / data-edit-attr), which a real
// browser parses onto the body element.
const bodyTag = demoHtml.match(/<body([^>]*)>/)[1];
const bodyMarkup = demoHtml
  .match(/<body[^>]*>([\s\S]*)<\/body>/)[1]
  .replace(/<script[\s\S]*?<\/script>/g, '');

function mountBody() {
  document.body.innerHTML = bodyMarkup;
  // re-apply the <body> attributes (innerHTML doesn't touch the body element itself)
  for (const m of bodyTag.matchAll(/([\w-]+)="([^"]*)"/g)) {
    document.body.setAttribute(m[1], m[2]);
  }
  // neutralize the YouTube embed so happy-dom doesn't attempt a network fetch
  document.querySelectorAll('[data-edit-video]').forEach((el) => {
    el.dataset.src = '';
    el.removeAttribute('data-src');
  });
}

// what the inline module script does — replicated against the built bundle
const bundle = await import(resolve(here, '../../dist/ratatui-cms.min.js'));
const { autocms, knob, bind, flushSync } = bundle;

beforeEach(() => {
  document.head.innerHTML = '';
  localStorage.clear();
});

describe('demo.html end-to-end (real markup + real bundle)', () => {
  it('boots, edits, themes, and persists', async () => {
    mountBody();

    const api = await autocms({ gate: 'always', storageKey: 'ratatui:demo' });
    api.editing.set('on');
    flushSync();

    // ── signals exist for every annotated element ──
    expect(api.signals.heroTitle.get()).toContain('CMS layer');
    expect(api.signals.heroSub.get()).toContain('Zero JavaScript');
    expect(api.signals.stat2.get()).toBe('0');
    expect(api.signals.alignment.get()).toBe('center');
    expect(api.signals.theme.get()).toBe('dark');

    // ── editing is live: hero title is contentEditable ──
    const hero = document.querySelector('.hero-title');
    expect(hero.contentEditable).toBe('plaintext-only');

    // ── edit the headline like a user ──
    hero.textContent = 'I just edited production HTML.';
    hero.dispatchEvent(new Event('input'));
    flushSync();
    expect(api.signals.heroTitle.get()).toBe('I just edited production HTML.');
    expect(api.draft.dirty.get()).toBe(true);

    // ── list rendered from template ──
    const todos = api.signals.todos.get();
    expect(todos.length).toBe(3);
    expect(todos[0].task).toContain('Click a row');

    // ── theme: set the signal, body attribute follows (data-edit-attr) ──
    api.signals.theme.set('light');
    flushSync();
    expect(document.body.getAttribute('data-theme')).toBe('light');

    // ── hue via the real range input (preset path) ──
    const hueDial = document.getElementById('hueDial');
    hueDial.value = '18';
    hueDial.dispatchEvent(new Event('input'));
    flushSync();
    expect(api.signals.hue.get()).toBe(18);

    // ── publish → localStorage round-trips ──
    await api.draft.save();
    const stored = JSON.parse(localStorage.getItem('ratatui:demo'));
    expect(stored.snapshot.heroTitle).toBe('I just edited production HTML.');
    expect(stored.snapshot.theme).toBe('light');
    expect(stored.snapshot.hue).toBe(18);

    api.dispose();
  });

  it('restores saved state on reload (the persistence moment)', async () => {
    localStorage.setItem('ratatui:demo', JSON.stringify({
      snapshot: { heroTitle: 'Saved headline', theme: 'light', hue: 140 },
      version: '7',
    }));

    mountBody();

    const api = await autocms({ gate: 'always', storageKey: 'ratatui:demo' });
    flushSync();

    expect(api.signals.heroTitle.get()).toBe('Saved headline');
    expect(document.querySelector('.hero-title').textContent).toBe('Saved headline');
    expect(api.signals.theme.get()).toBe('light');
    expect(document.body.getAttribute('data-theme')).toBe('light');
    expect(api.signals.hue.get()).toBe(140);
    expect(document.getElementById('hueDial').value).toBe('140');

    api.dispose();
  });
});
