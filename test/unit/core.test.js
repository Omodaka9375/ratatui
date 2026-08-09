import { describe, it, expect } from 'vitest';
import * as core from '../../src/index.js';

describe('knob', () => {
  it('should hold and return a value', () => {
    const { knob } = core;
    const k = knob(10);
    expect(k.get()).toBe(10);
  });

  it('should update value via set', () => {
    const { knob } = core;
    const k = knob(10);
    k.set(20);
    expect(k.get()).toBe(20);
  });

  it('should not update if value is identical', () => {
    const { knob } = core;
    let setCalled = false;
    const k = knob(10);
    k.subscribe(() => { setCalled = true; });
    k.set(10);
    expect(setCalled).toBe(false);
  });
});

describe('derive', () => {
  it('should compute derived value from sources', () => {
    const { derive, knob } = core;
    const s1 = knob(1);
    const s2 = knob(2);
    const d = derive([s1, s2], (a, b) => a + b);
    expect(d.get()).toBe(3);
  });

  it('should update when source changes', async () => {
    const { derive, knob } = core;
    const s1 = knob(1);
    const s2 = knob(2);
    const d = derive([s1, s2], (a, b) => a + b);
    
    s1.set(10);
    // Wait for microtask flush
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(d.get()).toBe(12);
  });
});

describe('bind', () => {
  it('should apply transformation to target', async () => {
    const { bind, knob } = core;
    const s1 = knob(1);
    let target = 0;
    bind(s1, (v) => v * 2, (res) => { target = res; });
    expect(target).toBe(2);
    
    s1.set(5);
    // Wait for microtask flush
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(target).toBe(10);
  });
});
