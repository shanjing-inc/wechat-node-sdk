import { describe, expect, it } from 'vitest';
import { WechatConfigError, type HttpClient } from '../src/core/index.js';
import { OpenWorkClient } from '../src/open-work/index.js';

describe('OpenWorkClient', () => {
  it('caches suite access token', async () => {
    let tokenRequests = 0;
    const httpClient: HttpClient = {
      async request(options) {
        if (options.path === '/cgi-bin/service/get_suite_token') {
          tokenRequests += 1;
          return {
            suite_access_token: 'suite-token',
            expires_in: 7200
          } as never;
        }

        return { pre_auth_code: 'pre-auth-code', expires_in: 600 } as never;
      }
    };
    const client = new OpenWorkClient({
      suiteId: 'suite-id',
      suiteSecret: 'suite-secret',
      suiteTicket: 'suite-ticket',
      httpClient
    });

    await expect(client.getPreAuthCode()).resolves.toEqual({
      pre_auth_code: 'pre-auth-code',
      expires_in: 600
    });
    await expect(client.getSuiteAccessToken()).resolves.toBe('suite-token');
    expect(tokenRequests).toBe(1);
  });

  it('requires suite ticket', async () => {
    const client = new OpenWorkClient({
      suiteId: 'suite-id',
      suiteSecret: 'suite-secret'
    });

    await expect(client.getSuiteAccessToken()).rejects.toBeInstanceOf(WechatConfigError);
  });
});
