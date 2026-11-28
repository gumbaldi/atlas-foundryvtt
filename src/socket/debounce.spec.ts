import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs once, after the last call of a burst', () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000);
    d.call();
    vi.advanceTimersByTime(600);
    d.call();
    vi.advanceTimersByTime(600);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs again for a later burst', () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000);
    d.call();
    vi.advanceTimersByTime(1000);
    d.call();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel drops a pending run', () => {
    const fn = vi.fn();
    const d = debounce(fn, 1000);
    d.call();
    d.cancel();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });
});
