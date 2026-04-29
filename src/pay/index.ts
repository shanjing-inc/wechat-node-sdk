import {
  createWebCryptoAdapter,
  type CryptoAdapter
} from '../core/crypto/index.js';
import { WechatApiError, WechatConfigError } from '../core/errors/index.js';
import { buildUrl, type HttpMethod, type QueryValue } from '../core/http/index.js';
import {
  parseConfig,
  WechatPayConfigSchema,
  type WechatPayConfig
} from '../core/config/index.js';

export type PayClientOptions = WechatPayConfig & {
  baseUrl?: string;
  fetch?: typeof fetch;
  crypto?: CryptoAdapter;
  timeoutMs?: number;
};

export type PayRequestOptions = {
  method?: HttpMethod;
  path: string;
  query?: Record<string, QueryValue | QueryValue[]>;
  headers?: HeadersInit;
  body?: unknown;
  timeoutMs?: number;
};

export type PayNotificationResource = {
  algorithm: 'AEAD_AES_256_GCM' | string;
  ciphertext: string;
  nonce: string;
  associated_data?: string;
  original_type?: string;
};

export type JsapiTransactionInput = {
  openid: string;
  description: string;
  outTradeNo: string;
  notifyUrl: string;
  amount: {
    total: number;
    currency?: string;
  };
  attach?: string;
  goodsTag?: string;
};

export type JsapiTransactionResult = {
  prepay_id: string;
};

export type JsapiPaySign = {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
};

const defaultPayBaseUrl = 'https://api.mch.weixin.qq.com';

export class PayClient {
  readonly config: WechatPayConfig;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly crypto: CryptoAdapter;
  private readonly timeoutMs: number;

  constructor(options: PayClientOptions) {
    this.config = parseConfig(WechatPayConfigSchema, options);
    this.baseUrl = options.baseUrl ?? defaultPayBaseUrl;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.crypto = options.crypto ?? createWebCryptoAdapter();
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async request<T = unknown>(options: PayRequestOptions): Promise<T> {
    const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
    const bodyText = normalizePayBody(options.body);
    const url = buildUrl(this.baseUrl, options.path, options.query);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomString(this.crypto, 16);
    const authorization = await this.createAuthorization({
      method,
      url,
      timestamp,
      nonce,
      body: bodyText
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs);

    try {
      const headers = new Headers(options.headers);
      headers.set('authorization', authorization);
      headers.set('accept', 'application/json');

      if (bodyText.length > 0 && !headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }

      const init: RequestInit = {
        method,
        headers,
        signal: controller.signal
      };

      if (bodyText.length > 0) {
        init.body = bodyText;
      }

      const response = await this.fetchImpl(url, init);
      const payload = await parsePayResponse(response);

      if (!response.ok) {
        const requestId = response.headers.get('request-id') ?? undefined;
        throw new WechatApiError(`微信支付 API 请求失败：${response.status}`, {
          status: response.status,
          response: payload,
          requestId
        });
      }

      return payload as T;
    } catch (error) {
      if (error instanceof WechatApiError) {
        throw error;
      }

      throw new WechatApiError('微信支付 API 请求失败', { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  async transactionsJsapi(input: JsapiTransactionInput): Promise<JsapiTransactionResult> {
    return this.request<JsapiTransactionResult>({
      path: '/v3/pay/transactions/jsapi',
      body: {
        appid: this.config.appId,
        mchid: this.config.mchId,
        description: input.description,
        out_trade_no: input.outTradeNo,
        notify_url: input.notifyUrl,
        amount: input.amount,
        payer: {
          openid: input.openid
        },
        attach: input.attach,
        goods_tag: input.goodsTag
      }
    });
  }

  async queryTransactionByOutTradeNo(outTradeNo: string): Promise<unknown> {
    return this.request({
      path: `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}`,
      query: {
        mchid: this.config.mchId
      }
    });
  }

  async closeTransaction(outTradeNo: string): Promise<unknown> {
    return this.request({
      path: `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}/close`,
      body: {
        mchid: this.config.mchId
      }
    });
  }

  async createJsapiPaySign(prepayId: string): Promise<JsapiPaySign> {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = randomString(this.crypto, 16);
    const pkg = `prepay_id=${prepayId}`;
    const message = `${this.config.appId}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
    const paySign = await this.crypto.rsaSha256Sign(message, this.config.privateKey);

    return {
      appId: this.config.appId,
      timeStamp,
      nonceStr,
      package: pkg,
      signType: 'RSA',
      paySign
    };
  }

  async verifySignature(input: {
    timestamp: string;
    nonce: string;
    body: string;
    signature: string;
    publicKey: string;
  }): Promise<boolean> {
    const message = `${input.timestamp}\n${input.nonce}\n${input.body}\n`;
    return this.crypto.rsaSha256Verify(message, input.signature, input.publicKey);
  }

  async decryptNotificationResource<T = unknown>(resource: PayNotificationResource): Promise<T> {
    if (this.config.apiV3Key === undefined) {
      throw new WechatConfigError('解密微信支付回调需要 apiV3Key');
    }

    const decryptOptions = {
      key: this.config.apiV3Key,
      nonce: resource.nonce,
      ciphertext: resource.ciphertext
    };

    const plaintext = await this.crypto.aes256GcmDecrypt(
      resource.associated_data === undefined
        ? decryptOptions
        : { ...decryptOptions, associatedData: resource.associated_data }
    );

    return JSON.parse(plaintext) as T;
  }

  private async createAuthorization(input: {
    method: HttpMethod;
    url: string;
    timestamp: string;
    nonce: string;
    body: string;
  }): Promise<string> {
    const requestUrl = new URL(input.url);
    const pathWithQuery = `${requestUrl.pathname}${requestUrl.search}`;
    const message = `${input.method}\n${pathWithQuery}\n${input.timestamp}\n${input.nonce}\n${input.body}\n`;
    const signature = await this.crypto.rsaSha256Sign(message, this.config.privateKey);
    const params = {
      mchid: this.config.mchId,
      nonce_str: input.nonce,
      signature,
      timestamp: input.timestamp,
      serial_no: this.config.serialNo
    };

    return `WECHATPAY2-SHA256-RSA2048 ${Object.entries(params)
      .map(([key, value]) => `${key}="${value}"`)
      .join(',')}`;
  }
}

export function createPayClient(options: PayClientOptions): PayClient {
  return new PayClient(options);
}

function normalizePayBody(body: unknown): string {
  if (body === undefined || body === null) {
    return '';
  }

  if (typeof body === 'string') {
    return body;
  }

  return JSON.stringify(dropUndefined(body));
}

function dropUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(dropUndefined);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, dropUndefined(item)])
  );
}

function randomString(crypto: CryptoAdapter, size: number): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return [...crypto.randomBytes(size)].map((item) => alphabet[item % alphabet.length]).join('');
}

async function parsePayResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json') || text.trimStart().startsWith('{')) {
    return JSON.parse(text);
  }

  return text;
}
