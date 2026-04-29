import { describe, expect, it } from 'vitest';
import { MemoryCacheStore } from '../src/core/index.js';

describe('MemoryCacheStore', () => {
  it('reads cached values before ttl expires', async () => {
    const cache = new MemoryCacheStore();

    await cache.set('key', { ok: true }, 30);

    await expect(cache.get('key')).resolves.toEqual({ ok: true });
  });

  it('expires values', async () => {
    const cache = new MemoryCacheStore();

    await cache.set('key', 'value', 0);

    await expect(cache.get('key')).resolves.toBeNull();
  });
});
