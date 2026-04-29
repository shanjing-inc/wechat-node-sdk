import { MemoryCacheStore, type CacheStore } from '../core/cache/index.js';
import { WechatConfigError } from '../core/errors/index.js';
import type { HttpClient, HttpRequestOptions } from '../core/http/index.js';
import { FetchHttpClient } from '../core/http/index.js';

export type WorkClientOptions = {
  corpId: string;
  corpSecret?: string;
  cache?: CacheStore;
  httpClient?: HttpClient;
};

export type WorkAccessTokenResponse = {
  access_token: string;
  expires_in: number;
};

export type WorkMessage = {
  touser?: string;
  toparty?: string;
  totag?: string;
  msgtype: string;
  agentid: number;
  safe?: 0 | 1;
  enable_id_trans?: 0 | 1;
  enable_duplicate_check?: 0 | 1;
  duplicate_check_interval?: number;
  [key: string]: unknown;
};

export type WorkUser = {
  userid: string;
  name: string;
  department?: number[];
  position?: string;
  mobile?: string;
  gender?: '1' | '2';
  email?: string;
  avatar?: string;
  status?: number;
  [key: string]: unknown;
};

export type WorkDepartment = {
  id: number;
  name: string;
  parentid: number;
  order?: number;
  [key: string]: unknown;
};

export type WorkJsapiTicketResponse = {
  ticket: string;
  expires_in: number;
};

export class WorkClient {
  readonly corpId: string;
  private readonly corpSecret: string | undefined;
  private readonly cache: CacheStore;
  private readonly httpClient: HttpClient;
  private readonly cacheKey: string;

  constructor(options: WorkClientOptions) {
    this.corpId = options.corpId;
    this.corpSecret = options.corpSecret;
    this.cache = options.cache ?? new MemoryCacheStore();
    this.httpClient =
      options.httpClient ?? new FetchHttpClient({ baseUrl: 'https://qyapi.weixin.qq.com' });
    this.cacheKey = `wechat:work:${options.corpId}:access-token`;
  }

  async getAccessToken(): Promise<string> {
    this.assertCorpSecret();
    const cached = await this.cache.get<string>(this.cacheKey);

    if (cached !== null) {
      return cached;
    }

    const response = await this.httpClient.request<WorkAccessTokenResponse>({
      path: '/cgi-bin/gettoken',
      query: {
        corpid: this.corpId,
        corpsecret: this.corpSecret
      }
    });
    await this.cache.set(this.cacheKey, response.access_token, Math.max(response.expires_in - 120, 1));
    return response.access_token;
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

  async getUser(userid: string): Promise<WorkUser> {
    return this.request<WorkUser>({
      path: '/cgi-bin/user/get',
      query: { userid }
    });
  }

  async listDepartment(id?: number): Promise<{ department: WorkDepartment[] }> {
    return this.request<{ department: WorkDepartment[] }>({
      path: '/cgi-bin/department/list',
      query: { id }
    });
  }

  async listDepartmentUsers(departmentId: number, fetchChild = false): Promise<{ userlist: WorkUser[] }> {
    return this.request<{ userlist: WorkUser[] }>({
      path: '/cgi-bin/user/list',
      query: {
        department_id: departmentId,
        fetch_child: fetchChild ? 1 : 0
      }
    });
  }

  async sendMessage(message: WorkMessage): Promise<unknown> {
    return this.request({
      path: '/cgi-bin/message/send',
      body: message
    });
  }

  async getAgent(agentId: number): Promise<unknown> {
    return this.request({
      path: '/cgi-bin/agent/get',
      query: {
        agentid: agentId
      }
    });
  }

  async getJsapiTicket(): Promise<string> {
    const key = `wechat:work:${this.corpId}:jsapi-ticket`;
    const cached = await this.cache.get<string>(key);

    if (cached !== null) {
      return cached;
    }

    const response = await this.request<WorkJsapiTicketResponse>({
      path: '/cgi-bin/get_jsapi_ticket'
    });
    await this.cache.set(key, response.ticket, Math.max(response.expires_in - 120, 1));
    return response.ticket;
  }

  private assertCorpSecret(): void {
    if (this.corpSecret === undefined || this.corpSecret.length === 0) {
      throw new WechatConfigError('企业微信客户端需要 corpSecret 才能获取 access_token');
    }
  }
}

export function createWorkClient(options: WorkClientOptions): WorkClient {
  return new WorkClient(options);
}
