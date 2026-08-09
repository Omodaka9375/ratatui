import { describe, it, expect } from 'vitest';
import { deepEqual, refEqual } from '../../src/deep-equality.js';
import { knob } from '../../src/knob.js';

describe('deepEqual', () => {
  it('should return true for identical primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('hello', 'hello')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
  });

  it('should return false for different primitives', () => {
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('hello', 'world')).toBe(false);
    expect(deepEqual(true, false)).toBe(false);
  });

  it('should compare arrays deeply', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(deepEqual([{ a: 1 }], [{ a: 1 }])).toBe(true);
    expect(deepEqual([{ a: 1 }], [{ a: 2 }])).toBe(false);
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(deepEqual([1, [2, 3]], [1, [2, 4]])).toBe(false);
  });

  it('should compare objects deeply', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it('should return false for different types', () => {
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(deepEqual(1, '1')).toBe(false);
  });

  it('should handle empty structures', () => {
    expect(deepEqual([], [])).toBe(true);
    expect(deepEqual({}, {})).toBe(true);
    expect(deepEqual([], {})).toBe(false);
  });
});

describe('knob with deep equality', () => {
  const flush = () => new Promise(r => setTimeout(r, 0));

  it('should use custom equality function', async () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { a: 1, b: 2 };
    const obj3 = { a: 1, b: 3 };

    let subscribeCalled = 0;
    const k = knob(obj1, { equality: deepEqual });
    k.subscribe(() => subscribeCalled++);

    await flush();
    subscribeCalled = 0; // Reset after initial setup

    // Same content - should not trigger subscription
    k.set(obj2);
    await flush();
    expect(subscribeCalled).toBe(0);

    // Different content - should trigger subscription
    k.set(obj3);
    await flush();
    expect(subscribeCalled).toBe(1);
  });

  it('should use shallow equality by default', async () => {
    const obj1 = { a: 1 };
    const obj2 = { a: 1 }; // Different reference, same content

    let subscribeCalled = 0;
    const k = knob(obj1);
    k.subscribe(() => subscribeCalled++);

    await flush();
    subscribeCalled = 0; // Reset after initial setup

    // Different reference - should trigger subscription (shallow equality)
    k.set(obj2);
    await flush();
    expect(subscribeCalled).toBe(1);
  });

  it('should work with nested arrays', async () => {
    const arr1 = [1, [2, 3]];
    const arr2 = [1, [2, 3]];
    const arr3 = [1, [2, 4]];

    let subscribeCalled = 0;
    const k = knob(arr1, { equality: deepEqual });
    k.subscribe(() => subscribeCalled++);

    await flush();
    subscribeCalled = 0;

    k.set(arr2);
    await flush();
    expect(subscribeCalled).toBe(0);

    k.set(arr3);
    await flush();
    expect(subscribeCalled).toBe(1);
  });

  it('should handle complex nested objects', async () => {
    const obj1 = { user: { name: 'Alice', scores: [90, 85, 92] } };
    const obj2 = { user: { name: 'Alice', scores: [90, 85, 92] } };
    const obj3 = { user: { name: 'Alice', scores: [90, 85, 95] } };

    let subscribeCalled = 0;
    const k = knob(obj1, { equality: deepEqual });
    k.subscribe(() => subscribeCalled++);

    await flush();
    subscribeCalled = 0;

    k.set(obj2);
    await flush();
    expect(subscribeCalled).toBe(0);

    k.set(obj3);
    await flush();
    expect(subscribeCalled).toBe(1);
  });
});