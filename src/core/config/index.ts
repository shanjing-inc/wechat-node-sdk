import { z } from 'zod';
import { WechatConfigError } from '../errors/index.js';

export const WechatAppConfigSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().min(1).optional()
});

export const WechatMessageConfigSchema = WechatAppConfigSchema.extend({
  token: z.string().min(1).optional(),
  encodingAesKey: z.string().min(43).max(43).optional()
});

export const WechatPayConfigSchema = z.object({
  appId: z.string().min(1),
  mchId: z.string().min(1),
  serialNo: z.string().min(1),
  privateKey: z.string().min(1),
  apiV3Key: z.string().min(1).optional()
});

export type WechatAppConfig = z.infer<typeof WechatAppConfigSchema>;
export type WechatMessageConfig = z.infer<typeof WechatMessageConfigSchema>;
export type WechatPayConfig = z.infer<typeof WechatPayConfigSchema>;

export function parseConfig<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  throw new WechatConfigError('微信 SDK 配置校验失败', result.error);
}
