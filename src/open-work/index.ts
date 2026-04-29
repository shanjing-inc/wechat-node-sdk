import { MemoryCacheStore, type CacheStore } from '../core/cache/index.js';
import { WechatConfigError } from '../core/errors/index.js';
import type { HttpClient, HttpRequestOptions } from '../core/http/index.js';
import { FetchHttpClient } from '../core/http/index.js';

export type SuiteTicketProvider = string | (() => Promise<string> | string);

export type OpenWorkClientOptions = {
  suiteId: string;
  suiteSecret?: string;
  token?: string;
  encodingAesKey?: string;
  suiteTicket?: SuiteTicketProvider;
  cache?: CacheStore;
  httpClient?: HttpClient;
};

export type SuiteAccessTokenResponse = {
  suite_access_token: string;
  expires_in: number;
};

export type SuitePreAuthCodeResponse = {
  pre_auth_code: string;
  expires_in: number;
};

export type PermanentCodeResponse = {
  access_token?: string;
  expires_in?: number;
  permanent_code: string;
  auth_corp_info?: unknown;
  auth_info?: unknown;
  auth_user_info?: unknown;
};

export type CorpAccessTokenResponse = {
  access_token: string;
  expires_in: number;
};

export class OpenWorkClient {
  readonly suiteId: string;
  readonly suiteSecret: string | undefined;
  readonly token: string | undefined;
  readonly encodingAesKey: string | undefined;
  private readonly suiteTicket: SuiteTicketProvider | undefined;
  private readonly cache: CacheStore;
  private readonly httpClient: HttpClient;

  constructor(options: OpenWorkClientOptions) {
    this.suiteId = options.suiteId;
    this.suiteSecret = options.suiteSecret;
    this.token = options.token;
    this.encodingAesKey = options.encodingAesKey;
    this.suiteTicket = options.suiteTicket;
    this.cache = options.cache ?? new MemoryCacheStore();
    this.httpClient =
      options.httpClient ?? new FetchHttpClient({ baseUrl: 'https://qyapi.weixin.qq.com' });
  }

  async request<T = unknown>(options: HttpRequestOptions): Promise<T> {
    return this.httpClient.request<T>(options);
  }

  async getSuiteAccessToken(): Promise<string> {
    this.assertSuiteSecret();
    const cacheKey = `wechat:open-work:${this.suiteId}:suite-access-token`;
    const cached = await this.cache.get<string>(cacheKey);

    if (cached !== null) {
      return cached;
    }

    const suiteTicket = await this.resolveSuiteTicket();
    const response = await this.httpClient.request<SuiteAccessTokenResponse>({
      path: '/cgi-bin/service/get_suite_token',
      body: {
        suite_id: this.suiteId,
        suite_secret: this.suiteSecret,
        suite_ticket: suiteTicket
      }
    });
    await this.cache.set(cacheKey, response.suite_access_token, Math.max(response.expires_in - 120, 1));
    return response.suite_access_token;
  }

  async refreshSuiteAccessToken(): Promise<string> {
    await this.cache.delete(`wechat:open-work:${this.suiteId}:suite-access-token`);
    return this.getSuiteAccessToken();
  }

  async requestWithSuiteToken<T = unknown>(options: HttpRequestOptions): Promise<T> {
    const suiteAccessToken = await this.getSuiteAccessToken();

    return this.httpClient.request<T>({
      ...options,
      query: {
        ...options.query,
        suite_access_token: suiteAccessToken
      }
    });
  }

  async getPreAuthCode(): Promise<SuitePreAuthCodeResponse> {
    return this.requestWithSuiteToken<SuitePreAuthCodeResponse>({
      path: '/cgi-bin/service/get_pre_auth_code'
    });
  }

  async getPermanentCode(authCode: string): Promise<PermanentCodeResponse> {
    return this.requestWithSuiteToken<PermanentCodeResponse>({
      path: '/cgi-bin/service/get_permanent_code',
      body: {
        auth_code: authCode
      }
    });
  }

  async getCorpAccessToken(authCorpId: string, permanentCode: string): Promise<CorpAccessTokenResponse> {
    return this.requestWithSuiteToken<CorpAccessTokenResponse>({
      path: '/cgi-bin/service/get_corp_token',
      body: {
        auth_corpid: authCorpId,
        permanent_code: permanentCode
      }
    });
  }

  async requestWithCorpToken<T = unknown>(
    corpAccessToken: string,
    options: HttpRequestOptions
  ): Promise<T> {
    return this.httpClient.request<T>({
      ...options,
      query: {
        ...options.query,
        access_token: corpAccessToken
      }
    });
  }

  private async resolveSuiteTicket(): Promise<string> {
    if (this.suiteTicket === undefined) {
      throw new WechatConfigError('企业微信开放平台客户端需要 suiteTicket 才能获取 suite_access_token');
    }

    return typeof this.suiteTicket === 'function' ? this.suiteTicket() : this.suiteTicket;
  }

  private assertSuiteSecret(): void {
    if (this.suiteSecret === undefined || this.suiteSecret.length === 0) {
      throw new WechatConfigError('企业微信开放平台客户端需要 suiteSecret 才能获取 suite_access_token');
    }
  }
}

export function createOpenWorkClient(options: OpenWorkClientOptions): OpenWorkClient {
  return new OpenWorkClient(options);
}
