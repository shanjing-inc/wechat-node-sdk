import { describe, expect, it } from 'vitest';
import { WechatConfigError, type HttpClient } from '../src/core/index.js';
import { WorkClient } from '../src/work/index.js';

describe('WorkClient', () => {
  it('caches work access token and sends message', async () => {
    const requests: unknown[] = [];
    const httpClient: HttpClient = {
      async request(options) {
        requests.push(options);

        if (options.path === '/cgi-bin/gettoken') {
          return {
            access_token: 'work-token',
            expires_in: 7200
          } as never;
        }

        return { errcode: 0 } as never;
      }
    };
    const client = new WorkClient({
      corpId: 'corp-id',
      corpSecret: 'corp-secret',
      httpClient
    });

    await client.sendMessage({
      touser: 'user-id',
      msgtype: 'text',
      agentid: 1000001,
      text: { content: 'hello' }
    });
    await client.getUser('user-id');

    expect(requests).toHaveLength(3);
    expect(requests[1]).toMatchObject({
      path: '/cgi-bin/message/send',
      query: { access_token: 'work-token' }
    });
  });

  it('requires corpSecret for token requests', async () => {
    const client = new WorkClient({ corpId: 'corp-id' });

    await expect(client.getAccessToken()).rejects.toBeInstanceOf(WechatConfigError);
  });
});
