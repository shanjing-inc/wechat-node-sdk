import { describe, expect, it } from 'vitest';
import { WechatConfigError, type HttpClient } from '../src/core/index.js';
import { ChannelClient } from '../src/channel/index.js';

describe('ChannelClient', () => {
  it('requests channel api with access token', async () => {
    const paths: string[] = [];
    const httpClient: HttpClient = {
      async request(options) {
        paths.push(options.path);

        if (options.path === '/cgi-bin/token') {
          return {
            access_token: 'channel-token',
            expires_in: 7200
          } as never;
        }

        return { ok: true, query: options.query } as never;
      }
    };
    const client = new ChannelClient({
      appId: 'appid',
      appSecret: 'secret',
      httpClient
    });

    const result = await client.getBasicsInfo();

    expect(result).toEqual({
      ok: true,
      query: { access_token: 'channel-token' }
    });
    expect(paths).toEqual(['/cgi-bin/token', '/channels/ec/basics/info/get']);
  });

  it('requires appSecret for tokenized requests', async () => {
    const client = new ChannelClient({ appId: 'appid' });

    await expect(client.getAccessToken()).rejects.toBeInstanceOf(WechatConfigError);
  });
});
