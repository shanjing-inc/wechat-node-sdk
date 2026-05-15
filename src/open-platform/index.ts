import { MemoryCacheStore, type CacheStore } from '../core/cache/index.js';
import { WechatConfigError } from '../core/errors/index.js';
import type { HttpClient, HttpRequestOptions } from '../core/http/index.js';
import { FetchHttpClient } from '../core/http/index.js';
import { MiniAppClient } from '../mini-app/index.js';

export type TicketProvider = string | (() => Promise<string> | string);

export type OpenPlatformClientOptions = {
  appId: string;
  appSecret?: string;
  token?: string;
  encodingAesKey?: string;
  componentVerifyTicket?: TicketProvider;
  cache?: CacheStore;
  httpClient?: HttpClient;
};

export type ComponentAccessTokenResponse = {
  component_access_token: string;
  expires_in: number;
};

export type PreAuthCodeResponse = {
  pre_auth_code: string;
  expires_in: number;
};

export type QueryAuthResponse = {
  authorization_info: {
    authorizer_appid: string;
    authorizer_access_token: string;
    expires_in: number;
    authorizer_refresh_token: string;
    func_info?: unknown[];
  };
};

export type AuthorizerTokenResponse = {
  authorizer_access_token: string;
  expires_in: number;
  authorizer_refresh_token: string;
};

export class OpenPlatformClient {
  readonly appId: string;
  readonly appSecret: string | undefined;
  readonly token: string | undefined;
  readonly encodingAesKey: string | undefined;
  private readonly componentVerifyTicket: TicketProvider | undefined;
  private readonly cache: CacheStore;
  private readonly httpClient: HttpClient;

  constructor(options: OpenPlatformClientOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.token = options.token;
    this.encodingAesKey = options.encodingAesKey;
    this.componentVerifyTicket = options.componentVerifyTicket;
    this.cache = options.cache ?? new MemoryCacheStore();
    this.httpClient = options.httpClient ?? new FetchHttpClient();
  }

  async request<T = unknown>(options: HttpRequestOptions): Promise<T> {
    return this.httpClient.request<T>(options);
  }

  async getComponentAccessToken(): Promise<string> {
    this.assertAppSecret();
    const cacheKey = `wechat:open-platform:${this.appId}:component-access-token`;
    const cached = await this.cache.get<string>(cacheKey);

    if (cached !== null) {
      return cached;
    }

    const ticket = await this.resolveComponentVerifyTicket();
    const response = await this.httpClient.request<ComponentAccessTokenResponse>({
      path: '/cgi-bin/component/api_component_token',
      body: {
        component_appid: this.appId,
        component_appsecret: this.appSecret,
        component_verify_ticket: ticket
      }
    });
    await this.cache.set(cacheKey, response.component_access_token, Math.max(response.expires_in - 120, 1));
    return response.component_access_token;
  }

  async refreshComponentAccessToken(): Promise<string> {
    await this.cache.delete(`wechat:open-platform:${this.appId}:component-access-token`);
    return this.getComponentAccessToken();
  }

  async requestWithComponentToken<T = unknown>(options: HttpRequestOptions): Promise<T> {
    const componentAccessToken = await this.getComponentAccessToken();

    return this.httpClient.request<T>({
      ...options,
      query: {
        ...options.query,
        component_access_token: componentAccessToken
      }
    });
  }

  async createPreAuthCode(): Promise<PreAuthCodeResponse> {
    return this.requestWithComponentToken<PreAuthCodeResponse>({
      path: '/cgi-bin/component/api_create_preauthcode',
      body: {
        component_appid: this.appId
      }
    });
  }

  async queryAuth(authorizationCode: string): Promise<QueryAuthResponse> {
    return this.requestWithComponentToken<QueryAuthResponse>({
      path: '/cgi-bin/component/api_query_auth',
      body: {
        component_appid: this.appId,
        authorization_code: authorizationCode
      }
    });
  }

  async getAuthorizerInfo(authorizerAppId: string): Promise<unknown> {
    return this.requestWithComponentToken({
      path: '/cgi-bin/component/api_get_authorizer_info',
      body: {
        component_appid: this.appId,
        authorizer_appid: authorizerAppId
      }
    });
  }

  async refreshAuthorizerToken(
    authorizerAppId: string,
    authorizerRefreshToken: string
  ): Promise<AuthorizerTokenResponse> {
    return this.requestWithComponentToken<AuthorizerTokenResponse>({
      path: '/cgi-bin/component/api_authorizer_token',
      body: {
        component_appid: this.appId,
        authorizer_appid: authorizerAppId,
        authorizer_refresh_token: authorizerRefreshToken
      }
    });
  }

  async getAuthorizerAccessToken(authorizerAppId: string, authorizerRefreshToken: string): Promise<string> {
    const cacheKey = getAuthorizerAccessTokenCacheKey(authorizerAppId, authorizerRefreshToken);
    const cached = await this.cache.get<string>(cacheKey);

    if (cached !== null) {
      return cached;
    }

    return this.refreshAuthorizerAccessToken(authorizerAppId, authorizerRefreshToken);
  }

  async refreshAuthorizerAccessToken(
    authorizerAppId: string,
    authorizerRefreshToken: string
  ): Promise<string> {
    const cacheKey = getAuthorizerAccessTokenCacheKey(authorizerAppId, authorizerRefreshToken);
    await this.cache.delete(cacheKey);

    const response = await this.refreshAuthorizerToken(authorizerAppId, authorizerRefreshToken);
    const token = response.authorizer_access_token;
    const ttl = Math.max((response.expires_in ?? 7200) - 500, 1);
    await this.cache.set(cacheKey, token, ttl);

    return token;
  }

  getMiniAppWithRefreshToken(authorizerAppId: string, authorizerRefreshToken: string): MiniAppClient {
    return new MiniAppClient({
      appId: authorizerAppId,
      accessTokenProvider: () => this.getAuthorizerAccessToken(authorizerAppId, authorizerRefreshToken),
      httpClient: this.httpClient
    });
  }

  async requestWithAuthorizerToken<T = unknown>(
    authorizerAccessToken: string,
    options: HttpRequestOptions
  ): Promise<T> {
    return this.httpClient.request<T>({
      ...options,
      query: {
        ...options.query,
        access_token: authorizerAccessToken
      }
    });
  }

  private async resolveComponentVerifyTicket(): Promise<string> {
    if (this.componentVerifyTicket === undefined) {
      throw new WechatConfigError('开放平台客户端需要 componentVerifyTicket 才能获取 component_access_token');
    }

    return typeof this.componentVerifyTicket === 'function'
      ? this.componentVerifyTicket()
      : this.componentVerifyTicket;
  }

  private assertAppSecret(): void {
    if (this.appSecret === undefined || this.appSecret.length === 0) {
      throw new WechatConfigError('开放平台客户端需要 appSecret 才能获取 component_access_token');
    }
  }
}

export function getAuthorizerAccessTokenCacheKey(authorizerAppId: string, authorizerRefreshToken: string): string {
  return `open-platform.authorizer_access_token.${authorizerAppId}.${md5(authorizerRefreshToken)}`;
}

export function createOpenPlatformClient(options: OpenPlatformClientOptions): OpenPlatformClient {
  return new OpenPlatformClient(options);
}

function md5(input: string): string {
  const rotateLeft = (value: number, shift: number) => (value << shift) | (value >>> (32 - shift));
  const addUnsigned = (left: number, right: number) => {
    const leftHigh = left & 0x80000000;
    const rightHigh = right & 0x80000000;
    const leftLow = left & 0x40000000;
    const rightLow = right & 0x40000000;
    const result = (left & 0x3fffffff) + (right & 0x3fffffff);

    if (leftLow & rightLow) {
      return result ^ 0x80000000 ^ leftHigh ^ rightHigh;
    }

    if (leftLow | rightLow) {
      return result & 0x40000000 ? result ^ 0xc0000000 ^ leftHigh ^ rightHigh : result ^ 0x40000000 ^ leftHigh ^ rightHigh;
    }

    return result ^ leftHigh ^ rightHigh;
  };
  const f = (x: number, y: number, z: number) => (x & y) | (~x & z);
  const g = (x: number, y: number, z: number) => (x & z) | (y & ~z);
  const h = (x: number, y: number, z: number) => x ^ y ^ z;
  const i = (x: number, y: number, z: number) => y ^ (x | ~z);
  const transform = (
    fn: (x: number, y: number, z: number) => number,
    a: number,
    b: number,
    c: number,
    d: number,
    x: number,
    s: number,
    ac: number
  ) => addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, fn(b, c, d)), addUnsigned(x, ac)), s), b);
  const bytes = new TextEncoder().encode(input);
  const wordArray: number[] = [];
  let byteIndex = 0;

  for (; byteIndex < bytes.length; byteIndex += 1) {
    wordArray[byteIndex >> 2] =
      (wordArray[byteIndex >> 2] ?? 0) | ((bytes[byteIndex] ?? 0) << ((byteIndex % 4) * 8));
  }

  wordArray[byteIndex >> 2] = (wordArray[byteIndex >> 2] ?? 0) | (0x80 << ((byteIndex % 4) * 8));
  wordArray[(((byteIndex + 8) >> 6) + 1) * 16 - 2] = bytes.length * 8;
  wordArray[(((byteIndex + 8) >> 6) + 1) * 16 - 1] = bytes.length >>> 29;

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let block = 0; block < wordArray.length; block += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;

    a = transform(f, a, b, c, d, wordArray[block] ?? 0, 7, 0xd76aa478);
    d = transform(f, d, a, b, c, wordArray[block + 1] ?? 0, 12, 0xe8c7b756);
    c = transform(f, c, d, a, b, wordArray[block + 2] ?? 0, 17, 0x242070db);
    b = transform(f, b, c, d, a, wordArray[block + 3] ?? 0, 22, 0xc1bdceee);
    a = transform(f, a, b, c, d, wordArray[block + 4] ?? 0, 7, 0xf57c0faf);
    d = transform(f, d, a, b, c, wordArray[block + 5] ?? 0, 12, 0x4787c62a);
    c = transform(f, c, d, a, b, wordArray[block + 6] ?? 0, 17, 0xa8304613);
    b = transform(f, b, c, d, a, wordArray[block + 7] ?? 0, 22, 0xfd469501);
    a = transform(f, a, b, c, d, wordArray[block + 8] ?? 0, 7, 0x698098d8);
    d = transform(f, d, a, b, c, wordArray[block + 9] ?? 0, 12, 0x8b44f7af);
    c = transform(f, c, d, a, b, wordArray[block + 10] ?? 0, 17, 0xffff5bb1);
    b = transform(f, b, c, d, a, wordArray[block + 11] ?? 0, 22, 0x895cd7be);
    a = transform(f, a, b, c, d, wordArray[block + 12] ?? 0, 7, 0x6b901122);
    d = transform(f, d, a, b, c, wordArray[block + 13] ?? 0, 12, 0xfd987193);
    c = transform(f, c, d, a, b, wordArray[block + 14] ?? 0, 17, 0xa679438e);
    b = transform(f, b, c, d, a, wordArray[block + 15] ?? 0, 22, 0x49b40821);

    a = transform(g, a, b, c, d, wordArray[block + 1] ?? 0, 5, 0xf61e2562);
    d = transform(g, d, a, b, c, wordArray[block + 6] ?? 0, 9, 0xc040b340);
    c = transform(g, c, d, a, b, wordArray[block + 11] ?? 0, 14, 0x265e5a51);
    b = transform(g, b, c, d, a, wordArray[block] ?? 0, 20, 0xe9b6c7aa);
    a = transform(g, a, b, c, d, wordArray[block + 5] ?? 0, 5, 0xd62f105d);
    d = transform(g, d, a, b, c, wordArray[block + 10] ?? 0, 9, 0x02441453);
    c = transform(g, c, d, a, b, wordArray[block + 15] ?? 0, 14, 0xd8a1e681);
    b = transform(g, b, c, d, a, wordArray[block + 4] ?? 0, 20, 0xe7d3fbc8);
    a = transform(g, a, b, c, d, wordArray[block + 9] ?? 0, 5, 0x21e1cde6);
    d = transform(g, d, a, b, c, wordArray[block + 14] ?? 0, 9, 0xc33707d6);
    c = transform(g, c, d, a, b, wordArray[block + 3] ?? 0, 14, 0xf4d50d87);
    b = transform(g, b, c, d, a, wordArray[block + 8] ?? 0, 20, 0x455a14ed);
    a = transform(g, a, b, c, d, wordArray[block + 13] ?? 0, 5, 0xa9e3e905);
    d = transform(g, d, a, b, c, wordArray[block + 2] ?? 0, 9, 0xfcefa3f8);
    c = transform(g, c, d, a, b, wordArray[block + 7] ?? 0, 14, 0x676f02d9);
    b = transform(g, b, c, d, a, wordArray[block + 12] ?? 0, 20, 0x8d2a4c8a);

    a = transform(h, a, b, c, d, wordArray[block + 5] ?? 0, 4, 0xfffa3942);
    d = transform(h, d, a, b, c, wordArray[block + 8] ?? 0, 11, 0x8771f681);
    c = transform(h, c, d, a, b, wordArray[block + 11] ?? 0, 16, 0x6d9d6122);
    b = transform(h, b, c, d, a, wordArray[block + 14] ?? 0, 23, 0xfde5380c);
    a = transform(h, a, b, c, d, wordArray[block + 1] ?? 0, 4, 0xa4beea44);
    d = transform(h, d, a, b, c, wordArray[block + 4] ?? 0, 11, 0x4bdecfa9);
    c = transform(h, c, d, a, b, wordArray[block + 7] ?? 0, 16, 0xf6bb4b60);
    b = transform(h, b, c, d, a, wordArray[block + 10] ?? 0, 23, 0xbebfbc70);
    a = transform(h, a, b, c, d, wordArray[block + 13] ?? 0, 4, 0x289b7ec6);
    d = transform(h, d, a, b, c, wordArray[block] ?? 0, 11, 0xeaa127fa);
    c = transform(h, c, d, a, b, wordArray[block + 3] ?? 0, 16, 0xd4ef3085);
    b = transform(h, b, c, d, a, wordArray[block + 6] ?? 0, 23, 0x04881d05);
    a = transform(h, a, b, c, d, wordArray[block + 9] ?? 0, 4, 0xd9d4d039);
    d = transform(h, d, a, b, c, wordArray[block + 12] ?? 0, 11, 0xe6db99e5);
    c = transform(h, c, d, a, b, wordArray[block + 15] ?? 0, 16, 0x1fa27cf8);
    b = transform(h, b, c, d, a, wordArray[block + 2] ?? 0, 23, 0xc4ac5665);

    a = transform(i, a, b, c, d, wordArray[block] ?? 0, 6, 0xf4292244);
    d = transform(i, d, a, b, c, wordArray[block + 7] ?? 0, 10, 0x432aff97);
    c = transform(i, c, d, a, b, wordArray[block + 14] ?? 0, 15, 0xab9423a7);
    b = transform(i, b, c, d, a, wordArray[block + 5] ?? 0, 21, 0xfc93a039);
    a = transform(i, a, b, c, d, wordArray[block + 12] ?? 0, 6, 0x655b59c3);
    d = transform(i, d, a, b, c, wordArray[block + 3] ?? 0, 10, 0x8f0ccc92);
    c = transform(i, c, d, a, b, wordArray[block + 10] ?? 0, 15, 0xffeff47d);
    b = transform(i, b, c, d, a, wordArray[block + 1] ?? 0, 21, 0x85845dd1);
    a = transform(i, a, b, c, d, wordArray[block + 8] ?? 0, 6, 0x6fa87e4f);
    d = transform(i, d, a, b, c, wordArray[block + 15] ?? 0, 10, 0xfe2ce6e0);
    c = transform(i, c, d, a, b, wordArray[block + 6] ?? 0, 15, 0xa3014314);
    b = transform(i, b, c, d, a, wordArray[block + 13] ?? 0, 21, 0x4e0811a1);
    a = transform(i, a, b, c, d, wordArray[block + 4] ?? 0, 6, 0xf7537e82);
    d = transform(i, d, a, b, c, wordArray[block + 11] ?? 0, 10, 0xbd3af235);
    c = transform(i, c, d, a, b, wordArray[block + 2] ?? 0, 15, 0x2ad7d2bb);
    b = transform(i, b, c, d, a, wordArray[block + 9] ?? 0, 21, 0xeb86d391);

    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }

  return [a, b, c, d]
    .map((value) =>
      Array.from({ length: 4 }, (_entry, index) =>
        ((value >>> (index * 8)) & 0xff).toString(16).padStart(2, '0')
      ).join('')
    )
    .join('');
}
