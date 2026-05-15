import { MemoryCacheStore, type CacheStore } from '../core/cache/index.js';
import {
  parseConfig,
  WechatAppConfigSchema,
  type WechatAppConfig
} from '../core/config/index.js';
import type { HttpClient, HttpRequestOptions } from '../core/http/index.js';
import { FetchHttpClient } from '../core/http/index.js';
import { AccessTokenManager } from '../core/token/index.js';

export type MiniAppClientOptions = WechatAppConfig & {
  accessTokenProvider?: () => Promise<string> | string;
  cache?: CacheStore;
  httpClient?: HttpClient;
};

export type Code2SessionResult = {
  openid: string;
  session_key: string;
  unionid?: string;
};

export type PhoneNumberResult = {
  phone_info: {
    phoneNumber: string;
    purePhoneNumber: string;
    countryCode: string;
    watermark?: {
      timestamp: number;
      appid: string;
    };
  };
};

export class MiniAppClient {
  readonly config: WechatAppConfig;
  readonly tokenManager: AccessTokenManager | undefined;
  private readonly accessTokenProvider: (() => Promise<string> | string) | undefined;
  private readonly httpClient: HttpClient;

  constructor(options: MiniAppClientOptions) {
    this.config = parseConfig(WechatAppConfigSchema, options);
    const cache = options.cache ?? new MemoryCacheStore();
    this.accessTokenProvider = options.accessTokenProvider;
    this.httpClient = options.httpClient ?? new FetchHttpClient();
    this.tokenManager = this.accessTokenProvider
      ? undefined
      : new AccessTokenManager({
          appId: this.config.appId,
          appSecret: this.config.appSecret ?? '',
          cache,
          httpClient: this.httpClient,
          cacheKey: `wechat:mini-app:${this.config.appId}:access-token`
        });
  }

  async getAccessToken(): Promise<string> {
    if (this.accessTokenProvider) {
      return this.accessTokenProvider();
    }

    if (!this.tokenManager) {
      throw new Error('Missing access token manager.');
    }

    return this.tokenManager.getToken();
  }

  async request<T = unknown>(options: HttpRequestOptions): Promise<T> {
    const accessToken = await this.getAccessToken();

    return this.httpClient.request<T>({
      ...options,
      query: {
        ...options.query,
        access_token: accessToken
      }
    });
  }

  async code2Session(jsCode: string): Promise<Code2SessionResult> {
    return this.httpClient.request<Code2SessionResult>({
      path: '/sns/jscode2session',
      query: {
        appid: this.config.appId,
        secret: this.config.appSecret,
        js_code: jsCode,
        grant_type: 'authorization_code'
      }
    });
  }

  async getPhoneNumber(code: string): Promise<PhoneNumberResult> {
    return this.request<PhoneNumberResult>({
      path: '/wxa/business/getuserphonenumber',
      body: { code }
    });
  }

  async createQRCode(path: string, width = 430): Promise<ArrayBuffer> {
    return this.request<ArrayBuffer>({
      path: '/wxa/getwxacode',
      body: { path, width },
      responseType: 'arrayBuffer'
    });
  }
}

export function createMiniAppClient(options: MiniAppClientOptions): MiniAppClient {
  return new MiniAppClient(options);
}
