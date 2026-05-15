import { describe, expect, it } from 'vitest';
import { WechatConfigError, type HttpClient } from '../src/core/index.js';
import { OpenPlatformClient } from '../src/open-platform/index.js';

function createMemoryCache() {
  const values = new Map<string, string>();
  const ttlValues = new Map<string, number | undefined>();

  return {
    values,
    ttlValues,
    async get<T>(key: string) {
      return (values.get(key) ?? null) as T | null;
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      values.set(key, String(value));
      ttlValues.set(key, ttlSeconds);
    },
    async delete(key: string) {
      values.delete(key);
      ttlValues.delete(key);
    }
  };
}

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

  it('caches authorizer access token using the EasyWechat compatible key', async () => {
    let refreshRequests = 0;
    const cache = createMemoryCache();
    const httpClient: HttpClient = {
      async request(options) {
        if (options.path === '/cgi-bin/component/api_component_token') {
          return {
            component_access_token: 'component-token',
            expires_in: 7200
          } as never;
        }

        if (options.path === '/cgi-bin/component/api_authorizer_token') {
          refreshRequests += 1;

          return {
            authorizer_access_token: 'authorizer-token',
            authorizer_refresh_token: 'next-refresh-token',
            expires_in: 7200
          } as never;
        }

        return { ok: true, options } as never;
      }
    };
    const client = new OpenPlatformClient({
      appId: 'component-appid',
      appSecret: 'component-secret',
      cache,
      componentVerifyTicket: async () => 'ticket',
      httpClient
    });

    await expect(client.getAuthorizerAccessToken('authorizer-appid', 'refresh-token')).resolves.toBe(
      'authorizer-token'
    );
    await expect(client.getAuthorizerAccessToken('authorizer-appid', 'refresh-token')).resolves.toBe(
      'authorizer-token'
    );

    const cacheKey = 'open-platform.authorizer_access_token.authorizer-appid.5f7f16ef955814b78f2eb519fbbbaf37';

    expect(refreshRequests).toBe(1);
    expect(cache.values.get(cacheKey)).toBe('authorizer-token');
    expect(cache.ttlValues.get(cacheKey)).toBe(6700);
  });

  it('creates an authorized mini app client that reuses mini app APIs', async () => {
    const paths: string[] = [];
    const queries: Array<Record<string, unknown> | undefined> = [];
    const httpClient: HttpClient = {
      async request(options) {
        paths.push(options.path);
        queries.push(options.query);

        if (options.path === '/cgi-bin/component/api_component_token') {
          return {
            component_access_token: 'component-token',
            expires_in: 7200
          } as never;
        }

        if (options.path === '/cgi-bin/component/api_authorizer_token') {
          return {
            authorizer_access_token: 'authorizer-token',
            authorizer_refresh_token: 'next-refresh-token',
            expires_in: 7200
          } as never;
        }

        if (options.path === '/wxa/business/getuserphonenumber') {
          return {
            phone_info: {
              countryCode: '86',
              phoneNumber: '+8613800000000',
              purePhoneNumber: '13800000000'
            }
          } as never;
        }

        return { ok: true, options } as never;
      }
    };
    const client = new OpenPlatformClient({
      appId: 'component-appid',
      appSecret: 'component-secret',
      cache: createMemoryCache(),
      componentVerifyTicket: async () => 'ticket',
      httpClient
    });
    const miniApp = client.getMiniAppWithRefreshToken('authorizer-appid', 'refresh-token');

    await expect(miniApp.getPhoneNumber('phone-code')).resolves.toEqual({
      phone_info: {
        countryCode: '86',
        phoneNumber: '+8613800000000',
        purePhoneNumber: '13800000000'
      }
    });
    expect(paths).toContain('/wxa/business/getuserphonenumber');
    expect(queries.at(-1)).toEqual({
      access_token: 'authorizer-token'
    });
  });
});
