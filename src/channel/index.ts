import { MemoryCacheStore, type CacheStore } from '../core/cache/index.js';
import { WechatConfigError } from '../core/errors/index.js';
import type { HttpClient, HttpRequestOptions } from '../core/http/index.js';
import { FetchHttpClient } from '../core/http/index.js';
import { AccessTokenManager } from '../core/token/index.js';

export type ChannelClientOptions = {
  appId: string;
  appSecret?: string;
  cache?: CacheStore;
  httpClient?: HttpClient;
};

export type ChannelOrderListInput = {
  create_time_range?: {
    start_time?: number;
    end_time?: number;
  };
  status?: number;
  page_size?: number;
  next_key?: string;
};

export class ChannelClient {
  readonly appId: string;
  readonly appSecret: string | undefined;
  readonly tokenManager: AccessTokenManager | undefined;
  private readonly cache: CacheStore;
  private readonly httpClient: HttpClient;

  constructor(options: ChannelClientOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.cache = options.cache ?? new MemoryCacheStore();
    this.httpClient = options.httpClient ?? new FetchHttpClient();
    this.tokenManager =
      options.appSecret === undefined
        ? undefined
        : new AccessTokenManager({
            appId: options.appId,
            appSecret: options.appSecret,
            cache: this.cache,
            httpClient: this.httpClient,
            cacheKey: `wechat:channel:${options.appId}:access-token`
          });
  }

  async request<T = unknown>(options: HttpRequestOptions): Promise<T> {
    return this.httpClient.request<T>(options);
  }

  async getAccessToken(): Promise<string> {
    if (this.tokenManager === undefined) {
      throw new WechatConfigError('视频号客户端需要 appSecret 才能获取 access_token');
    }

    return this.tokenManager.getToken();
  }

  async requestWithAccessToken<T = unknown>(options: HttpRequestOptions): Promise<T> {
    const accessToken = await this.getAccessToken();

    return this.httpClient.request<T>({
      ...options,
      query: {
        ...options.query,
        access_token: accessToken
      }
    });
  }

  async getBasicsInfo(): Promise<unknown> {
    return this.requestWithAccessToken({
      path: '/channels/ec/basics/info/get'
    });
  }

  async listOrders(input: ChannelOrderListInput = {}): Promise<unknown> {
    return this.requestWithAccessToken({
      path: '/channels/ec/order/list/get',
      body: input
    });
  }

  async getOrder(orderId: string): Promise<unknown> {
    return this.requestWithAccessToken({
      path: '/channels/ec/order/get',
      body: {
        order_id: orderId
      }
    });
  }
}

export function createChannelClient(options: ChannelClientOptions): ChannelClient {
  return new ChannelClient(options);
}
