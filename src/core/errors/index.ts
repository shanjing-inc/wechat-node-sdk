export type WechatSdkErrorOptions = {
  code?: string;
  cause?: unknown;
};

export class WechatSdkError extends Error {
  readonly code: string;

  constructor(message: string, options: WechatSdkErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'WechatSdkError';
    this.code = options.code ?? 'WECHAT_SDK_ERROR';
  }
}

export class WechatConfigError extends WechatSdkError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'WECHAT_CONFIG_ERROR', cause });
    this.name = 'WechatConfigError';
  }
}

export class WechatCryptoError extends WechatSdkError {
  constructor(message: string, cause?: unknown) {
    super(message, { code: 'WECHAT_CRYPTO_ERROR', cause });
    this.name = 'WechatCryptoError';
  }
}

export class WechatApiError extends WechatSdkError {
  readonly status: number | undefined;
  readonly response: unknown | undefined;
  readonly requestId: string | undefined;

  constructor(
    message: string,
    options: WechatSdkErrorOptions & {
      status?: number | undefined;
      response?: unknown;
      requestId?: string | undefined;
    } = {}
  ) {
    super(message, { code: options.code ?? 'WECHAT_API_ERROR', cause: options.cause });
    this.name = 'WechatApiError';
    this.status = options.status;
    this.response = options.response;
    this.requestId = options.requestId;
  }
}
