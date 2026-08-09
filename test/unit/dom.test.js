// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { knob, bind, flushSync, mode } from '../../src/index.js';
import { slider, textInput, toggle, editable, editableImg, editableVideo } from '../../src/controls.js';
import { list } from '../../src/list.js';
import { show } from '../../src/show.js';

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  document.body.removeAttribute('data-mode-editing');
});

describe('controls: two-way wiring', () => {
  it('slider syncs input → knob and knob → input', () => {
    const el = document.createElement('input');
    el.type = 'range';
    document.body.appendChild(el);
    const k = knob(5, 'vol');

    slider(el, k);
    expect(el.value).toBe('5'); // bind runs at creation

    el.value = '8';
    el.dispatchEvent(new Event('input'));
    expect(k.get()).toBe(8);

    k.set(3);
    flushSync();
    expect(el.value).toBe('3');
  });

  it('slider dispose removes the DOM listener', () => {
    const el = document.createElement('input');
    el.type = 'range';
    document.body.appendChild(el);
    const k = knob(1, 'vol');

    const dispose = slider(el, k);
    dispose();

    el.value = '9';
    el.dispatchEvent(new Event('input'));
    expect(k.get()).toBe(1); // no ghost updates after dispose

    k.set(4);
    flushSync();
    expect(el.value).toBe('9'); // bind removed too
  });

  it('textInput syncs both ways', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    const k = knob('a', 'name');

    textInput(el, k);
    expect(el.value).toBe('a');

    el.value = 'b';
    el.dispatchEvent(new Event('input'));
    expect(k.get()).toBe('b');

    k.set('c');
    flushSync();
    expect(el.value).toBe('c');
  });

  it('toggle syncs checkbox state', () => {
    const el = document.createElement('input');
    el.type = 'checkbox';
    document.body.appendChild(el);
    const k = knob(false, 'flag');

    toggle(el, k);
    expect(el.checked).toBe(false);

    el.checked = true;
    el.dispatchEvent(new Event('change'));
    expect(k.get()).toBe(true);
  });
});

describe('editable', () => {
  it('writes signal value into the element and back', () => {
    const el = document.createElement('h1');
    el.textContent = 'Hello';
    document.body.appendChild(el);
    const s = knob('Hello', 'title');

    const dispose = editable(el, s);
    el.textContent = 'World';
    el.dispatchEvent(new Event('input'));
    expect(s.get()).toBe('World');

    s.set('Again');
    flushSync();
    expect(el.textContent).toBe('Again');

    dispose();
    el.textContent = 'Ghost';
    el.dispatchEvent(new Event('input'));
    expect(s.get()).toBe('Again');
  });

  it('toggles contentEditable with the editing signal', () => {
    const el = document.createElement('p');
    document.body.appendChild(el);
    const s = knob('text', 'body');
    const editing = knob(false, 'editing');

    editable(el, s, editing);
    expect(el.contentEditable).toBe('false');

    editing.set(true);
    flushSync();
    expect(el.contentEditable).toBe('plaintext-only');
    expect(el.classList.contains('is-editable')).toBe(true);

    editing.set(false);
    flushSync();
    expect(el.contentEditable).toBe('false');
    expect(el.classList.contains('is-editable')).toBe(false);
  });
});

describe('editableImg / editableVideo', () => {
  it('editableImg binds signal → img.src and cleans up', () => {
    const el = document.createElement('img');
    document.body.appendChild(el);
    const s = knob('a.png', 'hero');
    const editing = knob(false, 'editing');

    const dispose = editableImg(el, s, editing);
    expect(el.src).toContain('a.png');

    editing.set(true);
    flushSync();
    expect(el.classList.contains('rui-editable-media')).toBe(true);
    expect(el.getAttribute('tabindex')).toBe('0');

    dispose();
    expect(el.classList.contains('rui-editable-media')).toBe(false);
    expect(el.getAttribute('tabindex')).toBeNull();
  });

  it('editableVideo disables player pointer-events while editing so clicks open the editor', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const s = knob('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'vid2');
    const editing = knob(false, 'editing');

    const dispose = editableVideo(container, s, editing);
    const iframe = container.querySelector('iframe.rui-video-embed');
    expect(iframe).not.toBeNull();
    expect(iframe.style.pointerEvents).toBe(''); // interactive when not editing

    editing.set(true);
    flushSync();
    expect(iframe.style.pointerEvents).toBe('none'); // click reaches the container

    editing.set(false);
    flushSync();
    expect(iframe.style.pointerEvents).toBe(''); // restored

    dispose();
  });

  it('editableVideo converts YouTube watch URLs to embeds', () => {
    // toEmbedUrl is pure URL mapping — test it via a detached iframe so
    // happy-dom never attempts a network fetch for the src.
    const el = document.createElement('iframe');
    const s = knob('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'vid');

    const dispose = editableVideo(el, s);
    expect(el.getAttribute('src')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');

    s.set('https://vimeo.com/12345');
    flushSync();
    expect(el.getAttribute('src')).toBe('https://player.vimeo.com/video/12345');
    dispose();
  });
});

describe('list', () => {
  it('renders, adds, removes, and reorders keyed rows in the DOM', () => {
    const container = document.createElement('ul');
    document.body.appendChild(container);
    const items = knob([
      { id: 1, text: 'A' },
      { id: 2, text: 'B' },
    ], 'items');

    const dispose = list(container, items, (item) => {
      const li = document.createElement('li');
      li.textContent = item.get().text;
      return li;
    }, { key: (t) => t.id });

    expect(container.children.length).toBe(2);
    expect(container.children[0].textContent).toBe('A');

    items.set([{ id: 2, text: 'B' }, { id: 3, text: 'C' }]);
    flushSync();

    expect(container.children.length).toBe(2);
    expect(container.children[0].textContent).toBe('B'); // moved, not re-created
    expect(container.children[1].textContent).toBe('C'); // added

    dispose();
    expect(container.children.length).toBe(0);
  });
});

describe('show', () => {
  it('toggles hidden based on the predicate', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const k = knob(0, 'count');

    show(el, k, (v) => v > 0);
    expect(el.hidden).toBe(true);

    k.set(3);
    flushSync();
    expect(el.hidden).toBe(false);
  });
});

describe('mode', () => {
  it('stamps data-mode-* on body and cleans up on dispose', () => {
    const m = mode('editing', 'off');
    expect(document.body.getAttribute('data-mode-editing')).toBe('off');
    expect(document.querySelector('.rui-mode-badge')).not.toBeNull();

    m.set('on');
    flushSync();
    expect(document.body.getAttribute('data-mode-editing')).toBe('on');

    m.dispose();
    expect(document.body.hasAttribute('data-mode-editing')).toBe(false);
    expect(document.querySelector('.rui-mode-badge')).toBeNull();
  });
});
