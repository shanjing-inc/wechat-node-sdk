import { describe, expect, it } from 'vitest';
import { FetchHttpClient, WechatApiError, buildUrl } from '../src/core/index.js';

describe('FetchHttpClient', () => {
  it('builds url with query params', () => {
    expect(buildUrl('https://api.weixin.qq.com', '/cgi-bin/token', { appid: 'a', skip: undefined })).toBe(
      'https://api.weixin.qq.com/cgi-bin/token?appid=a'
    );
  });

  it('parses json response', async () => {
    const client = new FetchHttpClient({
      fetch: async () =>
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json' }
        })
    });

    await expect(client.request({ path: '/test' })).resolves.toEqual({ ok: true });
  });

  it('throws wechat api error for errcode', async () => {
    const client = new FetchHttpClient({
      fetch: async () =>
        new Response(JSON.stringify({ errcode: 40013, errmsg: 'invalid appid' }), {
          headers: { 'content-type': 'application/json' }
        })
    });

    await expect(client.request({ path: '/test' })).rejects.toBeInstanceOf(WechatApiError);
  });
});
