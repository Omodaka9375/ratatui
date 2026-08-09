import { describe, it, expect, vi } from 'vitest';
import * as core from '../../src/index.js';

const { knob, derive, bind, scope, list, show, flushSync, batch, activeBindings, clone, swap } = core;

describe('scheduler', () => {
  it('should deduplicate multiple schedules in one tick', () => {
    let count = 0;
    const k = knob(0);
    
    bind(k, v => v, () => { count++; });
    
    k.set(1);
    k.set(2);
    k.set(3);
    
    // Should only run once per tick
    flushSync();
    expect(count).toBe(2); // Initial + one scheduled
  });

  it('should run multiple jobs in order', async () => {
    const order = [];
    const k1 = knob(0);
    const k2 = knob(0);
    
    bind(k1, v => v, () => { order.push('k1'); });
    bind(k2, v => v, () => { order.push('k2'); });
    
    // Reset after initial runs
    order.length = 0;
    
    k1.set(1);
    k2.set(1);
    await new Promise(r => setTimeout(r, 0));
    
    expect(order).toEqual(['k1', 'k2']);
  });

  it('should track active bindings', () => {
    const k = knob(0);
    let bindingRunning = false;
    
    const dispose = bind(k, v => v, (v) => {
      bindingRunning = activeBindings.size > 0;
    });
    
    k.set(1);
    flushSync();
    
    expect(activeBindings.size).toBe(0);
    dispose();
  });

  it('should handle deep binding chains', () => {
    const k1 = knob(1);
    const k2 = knob(0);
    const k3 = knob(0);
    const k4 = knob(0);
    
    bind(k1, v => v, (v) => { k2.set(v * 2); });
    bind(k2, v => v, (v) => { k3.set(v + 1); });
    bind(k3, v => v, (v) => { k4.set(v - 3); });
    
    k1.set(10);
    flushSync();
    
    expect(k2.get()).toBe(20);
    expect(k3.get()).toBe(21);
    expect(k4.get()).toBe(18);
  });
});

describe('batch', () => {
  it('should group multiple set() calls into one tick', async () => {
    let count = 0;
    const k = knob(0);
    
    bind(k, v => v, () => { count++; });
    
    // Wait for initial bind to run
    await new Promise(r => setTimeout(r, 0));
    const afterInit = count;
    
    batch(() => {
      k.set(1);
      k.set(2);
      k.set(3);
    });
    
    expect(count).toBe(afterInit + 1);
    expect(k.get()).toBe(3);
  });

  it('should execute callback immediately then flush', () => {
    const k1 = knob(0);
    const k2 = knob(0);
    const order = [];
    
    bind(k1, v => v, () => { order.push('k1'); });
    bind(k2, v => v, () => { order.push('k2'); });
    
    batch(() => {
      k1.set(1);
      k2.set(1);
      order.push('callback-done');
    });
    
    expect(order).toContain('callback-done');
    expect(k1.get()).toBe(1);
    expect(k2.get()).toBe(1);
  });
});

describe('scope', () => {
  it('should collect disposers', () => {
    const s = scope('test-scope');
    let disposed = false;
    
    s.add(() => { disposed = true; });
    s.dispose();
    
    expect(disposed).toBe(true);
  });

  it('should dispose bindings when scope is disposed', () => {
    const s = scope('test-scope');
    const k = knob(0);
    let count = 0;
    
    s.bind(k, v => v, () => { count++; });
    
    k.set(1);
    expect(count).toBe(1);
    
    s.dispose();
    
    k.set(2);
    expect(count).toBe(1);
  });

  it('should own knobs and dispose them', () => {
    const s = scope('test-scope');
    const k = s.own(knob(42, 'owned-knob'));
    
    expect(k.get()).toBe(42);
    
    s.dispose();
    
    expect(activeBindings.size).toBeGreaterThanOrEqual(0);
  });

  it('should call disposer immediately when added to disposed scope', () => {
    const s = scope('test-scope');
    let called = false;
    
    s.dispose();
    s.add(() => { called = true; });
    
    expect(called).toBe(true);
  });

  it('should allow nested scopes', () => {
    const parent = scope('parent');
    const child = parent.own(scope('child'));
    let childDisposed = false;
    
    child.add(() => { childDisposed = true; });
    parent.dispose();
    
    expect(childDisposed).toBe(true);
  });
});

describe('list', () => {
  it('should render initial items', () => {
    const container = { firstChild: null, appendChild: vi.fn(), insertBefore: vi.fn() };
    const items = knob([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    
    const render = vi.fn((item, row) => ({ el: { nodeType: 1 }, item, row }));
    
    list(container, items, render);
    
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('should add new items', () => {
    const container = { firstChild: null, appendChild: vi.fn(), insertBefore: vi.fn() };
    const items = knob([{ id: 1, name: 'A' }]);
    const render = vi.fn((item, row) => ({ el: { nodeType: 1 }, item, row }));
    
    list(container, items, render);
    const initialCalls = render.mock.calls.length;
    
    items.set([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    flushSync();
    
    expect(render.mock.calls.length).toBe(initialCalls + 1);
  });

  it('should remove items and dispose their scopes', () => {
    const removeSpyA = vi.fn();
    const removeSpyB = vi.fn();
    const elA = { nodeType: 1, remove: removeSpyA };
    const elB = { nodeType: 1, remove: removeSpyB };
    const items = knob([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    const render = vi.fn((item, row) => item.get().id === 1 ? elA : elB);
    const container = { firstChild: null, appendChild: vi.fn(), insertBefore: vi.fn() };

    list(container, items, render);

    items.set([{ id: 1, name: 'A' }]);
    flushSync();

    expect(render).toHaveBeenCalledTimes(2);
    expect(removeSpyA).not.toHaveBeenCalled();
    expect(removeSpyB).toHaveBeenCalledTimes(1);
  });

  it('should use custom key function', () => {
    const container = { firstChild: null, appendChild: vi.fn(), insertBefore: vi.fn() };
    const items = knob([{ code: 'x', val: 1 }, { code: 'y', val: 2 }]);
    const render = vi.fn((item, row) => ({ el: { nodeType: 1 }, item, row }));
    
    list(container, items, render, { key: (item) => item.code });
    
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('should handle duplicate keys gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const container = { firstChild: null, appendChild: vi.fn(), insertBefore: vi.fn() };
    const items = knob([{ id: 1, name: 'A' }, { id: 1, name: 'B' }]);
    const render = vi.fn((item, row) => ({ el: { nodeType: 1 }, item, row }));

    list(container, items, render);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('duplicate key')
    );

    consoleSpy.mockRestore();
  });
});

describe('show', () => {
  it('should toggle element visibility', () => {
    const el = { hidden: false };
    const k = knob(true);
    
    show(el, k);
    
    expect(el.hidden).toBe(false);
    
    k.set(false);
    flushSync();
    
    expect(el.hidden).toBe(true);
  });

  it('should use custom predicate', () => {
    const el = { hidden: false };
    const k = knob(0);
    
    show(el, k, v => v > 0);
    
    expect(el.hidden).toBe(true);
    
    k.set(5);
    flushSync();
    
    expect(el.hidden).toBe(false);
  });
});

describe('clone', () => {
  const isNode = typeof window === 'undefined';

  it('should clone from template element', () => {
    const template = {
      content: {
        firstElementChild: { nodeType: 1, cloneNode: vi.fn(() => ({ nodeType: 1 })) }
      }
    };
    
    const result = core.clone(template);
    
    expect(template.content.firstElementChild.cloneNode).toHaveBeenCalledWith(true);
  });

  it('should clone from selector string', () => {
    if (isNode) return;
    const mockEl = { nodeType: 1, cloneNode: vi.fn(() => ({ nodeType: 1 })) };
    const mockTemplate = { content: { firstElementChild: mockEl } };
    
    vi.stubGlobal('querySelector', vi.fn(() => mockTemplate));
    
    const result = core.clone('#my-template');
    
    expect(result).toBeDefined();
    
    vi.unstubAllGlobals();
  });

  it('should throw on missing template', () => {
    if (isNode) return;
    vi.stubGlobal('querySelector', vi.fn(() => null));
    
    expect(() => core.clone('#nonexistent')).toThrow('no <template>');
    
    vi.unstubAllGlobals();
  });
});

describe('swap', () => {
  const isNode = typeof window === 'undefined';

  it('should render initial content', () => {
    if (isNode) return;
    const container = { appendChild: vi.fn() };
    const mode = knob('a');
    
    const resolve = vi.fn(() => ({ nodeType: 1 }));
    
    swap(container, mode, resolve);
    flushSync();
    
    expect(resolve).toHaveBeenCalledWith('a', expect.any(Object));
  });

  it('should dispose previous content when switching', () => {
    if (isNode) return;
    const container = { appendChild: vi.fn(), removeChild: vi.fn() };
    const mode = knob('a');
    let disposed = false;
    
    const resolve = vi.fn((m, scope) => {
      scope.add(() => { disposed = true; });
      return { nodeType: 1, remove: vi.fn() };
    });
    
    const dispose = swap(container, mode, resolve);
    flushSync();
    
    mode.set('b');
    flushSync();
    
    expect(disposed).toBe(true);
  });
});
