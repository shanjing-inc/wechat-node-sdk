import { MemoryCacheStore, type CacheStore } from '../core/cache/index.js';
import { WechatConfigError } from '../core/errors/index.js';
import type { HttpClient, HttpRequestOptions } from '../core/http/index.js';
import { FetchHttpClient } from '../core/http/index.js';

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

export function createOpenPlatformClient(options: OpenPlatformClientOptions): OpenPlatformClient {
  return new OpenPlatformClient(options);
}
