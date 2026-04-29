import { WechatApiError } from '../errors/index.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;

export type HttpRequestOptions = {
  method?: HttpMethod;
  baseUrl?: string;
  path: string;
  query?: Record<string, QueryValue | QueryValue[]>;
  headers?: HeadersInit;
  body?: unknown;
  responseType?: 'json' | 'text' | 'arrayBuffer';
  timeoutMs?: number;
};

export interface HttpClient {
  request<T = unknown>(options: HttpRequestOptions): Promise<T>;
}

export type FetchHttpClientOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  defaultHeaders?: HeadersInit;
  timeoutMs?: number;
};

type AnyRecord = Record<string, unknown>;

const defaultBaseUrl = 'https://api.weixin.qq.com';

export class FetchHttpClient implements HttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: HeadersInit | undefined;
  private readonly timeoutMs: number;

  constructor(options: FetchHttpClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? defaultBaseUrl;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.defaultHeaders = options.defaultHeaders;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async request<T = unknown>(options: HttpRequestOptions): Promise<T> {
    const url = buildUrl(options.baseUrl ?? this.baseUrl, options.path, options.query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs);

    try {
      const init = this.createRequestInit(options, controller.signal);
      const response = await this.fetchImpl(url, init);
      const payload = await parseResponse(response, options.responseType);

      if (!response.ok) {
        const requestId = response.headers.get('request-id') ?? undefined;
        throw new WechatApiError(`微信 API HTTP 请求失败：${response.status}`, {
          status: response.status,
          response: payload,
          requestId
        });
      }

      assertWechatApiSuccess(payload);
      return payload as T;
    } catch (error) {
      if (error instanceof WechatApiError) {
        throw error;
      }

      throw new WechatApiError('微信 API 请求失败', { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  private createRequestInit(options: HttpRequestOptions, signal: AbortSignal): RequestInit {
    const headers = new Headers(this.defaultHeaders);

    if (options.headers !== undefined) {
      new Headers(options.headers).forEach((value, key) => headers.set(key, value));
    }

    const body = normalizeBody(options.body, headers);

    const init: RequestInit = {
      method: options.method ?? (body === undefined ? 'GET' : 'POST'),
      headers,
      signal
    };

    if (body !== undefined) {
      init.body = body;
    }

    return init;
  }
}

export function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue | QueryValue[]>
): string {
  const url = new URL(path, ensureTrailingSlash(baseUrl));

  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          appendQueryValue(url, key, item);
        }
      } else {
        appendQueryValue(url, key, value);
      }
    }
  }

  return url.toString();
}

function appendQueryValue(url: URL, key: string, value: QueryValue): void {
  if (value === undefined || value === null) {
    return;
  }

  url.searchParams.append(key, String(value));
}

function ensureTrailingSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function normalizeBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (
    typeof body === 'string' ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ReadableStream
  ) {
    return body;
  }

  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return JSON.stringify(body);
}

async function parseResponse(
  response: Response,
  responseType?: HttpRequestOptions['responseType']
): Promise<unknown> {
  if (responseType === 'arrayBuffer') {
    return response.arrayBuffer();
  }

  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  if (responseType === 'text') {
    return text;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (responseType === 'json' || contentType.includes('application/json') || looksLikeJson(text)) {
    return JSON.parse(text);
  }

  return text;
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function assertWechatApiSuccess(payload: unknown): void {
  if (!isRecord(payload)) {
    return;
  }

  const errcode = payload.errcode;

  if ((typeof errcode === 'number' && errcode !== 0) || (typeof errcode === 'string' && errcode !== '0')) {
    const message = typeof payload.errmsg === 'string' ? payload.errmsg : '微信 API 返回错误';
    throw new WechatApiError(message, {
      code: `WECHAT_API_${errcode}`,
      response: payload
    });
  }
}

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null;
}
