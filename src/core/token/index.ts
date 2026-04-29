import type { CacheStore } from '../cache/index.js';
import { MemoryCacheStore } from '../cache/index.js';
import type { HttpClient } from '../http/index.js';
import { FetchHttpClient } from '../http/index.js';

export type AccessTokenResponse = {
  access_token: string;
  expires_in: number;
};

export type AccessTokenManagerOptions = {
  appId: string;
  appSecret: string;
  cache?: CacheStore;
  httpClient?: HttpClient;
  cacheKey?: string;
};

export class AccessTokenManager {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly cache: CacheStore;
  private readonly httpClient: HttpClient;
  private readonly cacheKey: string;

  constructor(options: AccessTokenManagerOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.cache = options.cache ?? new MemoryCacheStore();
    this.httpClient = options.httpClient ?? new FetchHttpClient();
    this.cacheKey = options.cacheKey ?? `wechat:access-token:${options.appId}`;
  }

  async getToken(): Promise<string> {
    const cached = await this.cache.get<string>(this.cacheKey);

    if (cached !== null) {
      return cached;
    }

    return this.refreshToken();
  }

  async refreshToken(): Promise<string> {
    const response = await this.httpClient.request<AccessTokenResponse>({
      path: '/cgi-bin/token',
      query: {
        grant_type: 'client_credential',
        appid: this.appId,
        secret: this.appSecret
      }
    });

    const ttl = Math.max(response.expires_in - 120, 1);
    await this.cache.set(this.cacheKey, response.access_token, ttl);
    return response.access_token;
  }

  async invalidate(): Promise<void> {
    await this.cache.delete(this.cacheKey);
  }
}
