import { describe, expect, it } from 'vitest';
import { WechatConfigError, type HttpClient } from '../src/core/index.js';
import { OpenPlatformClient } from '../src/open-platform/index.js';

describe('OpenPlatformClient', () => {
  it('caches component access token', async () => {
    let tokenRequests = 0;
    const httpClient: HttpClient = {
      async request(options) {
        if (options.path === '/cgi-bin/component/api_component_token') {
          tokenRequests += 1;
          return {
            component_access_token: 'component-token',
            expires_in: 7200
          } as never;
        }

        return { ok: true, options } as never;
      }
    };
    const client = new OpenPlatformClient({
      appId: 'component-appid',
      appSecret: 'component-secret',
      componentVerifyTicket: async () => 'ticket',
      httpClient
    });

    await expect(client.getComponentAccessToken()).resolves.toBe('component-token');
    await expect(client.getComponentAccessToken()).resolves.toBe('component-token');
    expect(tokenRequests).toBe(1);
  });

  it('requires component verify ticket', async () => {
    const client = new OpenPlatformClient({
      appId: 'component-appid',
      appSecret: 'component-secret'
    });

    await expect(client.getComponentAccessToken()).rejects.toBeInstanceOf(WechatConfigError);
  });
});
