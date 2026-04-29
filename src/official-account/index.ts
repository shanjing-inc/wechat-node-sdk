import { MemoryCacheStore, type CacheStore } from '../core/cache/index.js';
import {
  parseConfig,
  WechatMessageConfigSchema,
  type WechatMessageConfig
} from '../core/config/index.js';
import type { HttpClient, HttpRequestOptions } from '../core/http/index.js';
import { FetchHttpClient } from '../core/http/index.js';
import { AccessTokenManager } from '../core/token/index.js';

export type OfficialAccountClientOptions = WechatMessageConfig & {
  cache?: CacheStore;
  httpClient?: HttpClient;
};

export type UserInfo = {
  subscribe: number;
  openid: string;
  language?: string;
  subscribe_time?: number;
  unionid?: string;
  remark?: string;
  groupid?: number;
  tagid_list?: number[];
  subscribe_scene?: string;
  qr_scene?: number;
  qr_scene_str?: string;
};

export type CallbackIpResult = {
  ip_list: string[];
};

export class OfficialAccountClient {
  readonly config: WechatMessageConfig;
  readonly tokenManager: AccessTokenManager;
  private readonly httpClient: HttpClient;

  constructor(options: OfficialAccountClientOptions) {
    this.config = parseConfig(WechatMessageConfigSchema, options);
    const cache = options.cache ?? new MemoryCacheStore();
    this.httpClient = options.httpClient ?? new FetchHttpClient();
    this.tokenManager = new AccessTokenManager({
      appId: this.config.appId,
      appSecret: this.config.appSecret ?? '',
      cache,
      httpClient: this.httpClient,
      cacheKey: `wechat:official-account:${this.config.appId}:access-token`
    });
  }

  async getAccessToken(): Promise<string> {
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

  async getCallbackIp(): Promise<CallbackIpResult> {
    return this.request<CallbackIpResult>({
      path: '/cgi-bin/getcallbackip'
    });
  }

  async getUserInfo(openid: string, lang = 'zh_CN'): Promise<UserInfo> {
    return this.request<UserInfo>({
      path: '/cgi-bin/user/info',
      query: {
        openid,
        lang
      }
    });
  }

  async createMenu(menu: unknown): Promise<unknown> {
    return this.request({
      path: '/cgi-bin/menu/create',
      body: menu
    });
  }

  async deleteMenu(): Promise<unknown> {
    return this.request({
      path: '/cgi-bin/menu/delete'
    });
  }
}

export function createOfficialAccountClient(options: OfficialAccountClientOptions): OfficialAccountClient {
  return new OfficialAccountClient(options);
}
