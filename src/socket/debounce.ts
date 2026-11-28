export interface Debounced {
  call(): void;
  cancel(): void;
}

/**
 * Trailing debounce: `fn` runs once, `delayMs` after the last `call()`. Bursts of
 * socket events (e.g. a bulk import) therefore cause one refresh, not one each.
 * Pure, no Foundry globals.
 */
export function debounce(fn: () => void, delayMs: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    call() {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, delayMs);
    },
    cancel() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
