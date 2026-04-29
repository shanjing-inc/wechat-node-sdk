import { describe, expect, it } from 'vitest';
import { AccessTokenManager, type HttpClient } from '../src/core/index.js';

describe('AccessTokenManager', () => {
  it('caches access token', async () => {
    let count = 0;
    const httpClient: HttpClient = {
      async request() {
        count += 1;
        return {
          access_token: `token-${count}`,
          expires_in: 7200
        } as never;
      }
    };
    const manager = new AccessTokenManager({
      appId: 'appid',
      appSecret: 'secret',
      httpClient
    });

    await expect(manager.getToken()).resolves.toBe('token-1');
    await expect(manager.getToken()).resolves.toBe('token-1');
    expect(count).toBe(1);
  });
});
