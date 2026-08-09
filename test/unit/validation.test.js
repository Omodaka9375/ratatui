import { describe, it, expect, vi } from 'vitest';
import { knob, registry } from '../../src/index.js';

describe('knob validation', () => {
  it('should accept valid numeric values within min/max', () => {
    const k = knob(5, { min: 0, max: 10, label: 'test-knob' });
    
    k.set(7);
    expect(k.get()).toBe(7);
  });

  it('should reject values below min', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const k = knob(5, { min: 0, max: 10, label: 'test-knob' });
    
    k.set(-1);
    expect(k.get()).toBe(5); // Should remain unchanged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Validation failed')
    );
    
    consoleSpy.mockRestore();
  });

  it('should reject values above max', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const k = knob(5, { min: 0, max: 10, label: 'test-knob' });
    
    k.set(15);
    expect(k.get()).toBe(5); // Should remain unchanged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Validation failed')
    );
    
    consoleSpy.mockRestore();
  });

  it('should accept values at boundary', () => {
    const k = knob(5, { min: 0, max: 10, label: 'test-knob' });
    
    k.set(0);
    expect(k.get()).toBe(0);
    
    k.set(10);
    expect(k.get()).toBe(10);
  });

  it('should validate string patterns', () => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const k = knob('test@example.com', { 
      pattern: emailPattern, 
      label: 'email-knob' 
    });
    
    k.set('valid@email.org');
    expect(k.get()).toBe('valid@email.org');
  });

  it('should reject strings not matching pattern', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const k = knob('test@example.com', { 
      pattern: emailPattern, 
      label: 'email-knob' 
    });
    
    k.set('invalid-email');
    expect(k.get()).toBe('test@example.com'); // Should remain unchanged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Validation failed')
    );
    
    consoleSpy.mockRestore();
  });

  it('should use custom validator function', () => {
    const isEven = (n) => n % 2 === 0;
    const k = knob(4, { 
      validator: isEven, 
      label: 'even-knob' 
    });
    
    k.set(8);
    expect(k.get()).toBe(8);
    
    k.set(7);
    expect(k.get()).toBe(8); // Should remain unchanged
  });

  it('should use custom validator with error message', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const positive = (n) => n > 0 || 'Must be positive';
    const k = knob(5, { 
      validator: positive,
      errorMessage: 'Value must be positive',
      label: 'positive-knob'
    });
    
    k.set(-3);
    expect(k.get()).toBe(5); // Should remain unchanged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Value must be positive')
    );
    
    consoleSpy.mockRestore();
  });

  it('should emit validation error event', () => {
    let eventReceived = null;
    const unsubscribe = registry.onEvent((event) => {
      if (event.type === 'knob:validation:error') {
        eventReceived = event;
      }
    });

    const k = knob(5, { min: 0, max: 10, label: 'test-knob' });
    k.set(100);

    expect(eventReceived).not.toBeNull();
    expect(eventReceived?.knob).toBe(k);
    // Error message should contain the validation failure reason
    expect(eventReceived?.error).toBeTruthy();

    unsubscribe();
  });

  it('should accept string label for backward compatibility', () => {
    const k = knob(42, 'my-knob');
    expect(k.label).toBe('my-knob');
    expect(k.get()).toBe(42);
  });

  it('should work with update() and validate result', () => {
    const k = knob(5, { min: 0, max: 10, label: 'test-knob' });
    
    k.update(v => v + 3);
    expect(k.get()).toBe(8);
    
    k.update(v => v + 5); // Would be 13, exceeds max
    expect(k.get()).toBe(8); // Should remain unchanged
  });

  it('should allow min only', () => {
    const k = knob(5, { min: 0, label: 'min-only' });

    k.set(100);
    expect(k.get()).toBe(100);

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    k.set(-1);
    expect(k.get()).toBe(100); // Should remain at last valid value
    consoleSpy.mockRestore();
  });

  it('should allow max only', () => {
    const k = knob(5, { max: 10, label: 'max-only' });

    k.set(-100);
    expect(k.get()).toBe(-100);

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    k.set(100);
    expect(k.get()).toBe(-100); // Should remain at last valid value
    consoleSpy.mockRestore();
  });

  it('should use custom error message', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const k = knob(5, { 
      min: 0, 
      max: 10, 
      errorMessage: 'Custom error: value out of range',
      label: 'custom-error'
    });
    
    k.set(100);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Custom error: value out of range')
    );
    
    consoleSpy.mockRestore();
  });
});
