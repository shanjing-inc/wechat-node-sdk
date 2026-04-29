import { describe, expect, it } from 'vitest';
import { type CryptoAdapter } from '../src/core/index.js';
import { PayClient } from '../src/pay/index.js';

const cryptoAdapter: CryptoAdapter = {
  async sha1() {
    return 'sha1';
  },
  async hmacSha256() {
    return 'hmac';
  },
  async rsaSha256Sign() {
    return 'c2lnbmVk';
  },
  async rsaSha256Verify() {
    return true;
  },
  async aes256GcmDecrypt() {
    return JSON.stringify({ ok: true });
  },
  randomBytes(size: number) {
    return new Uint8Array(size).fill(1);
  }
};

describe('PayClient', () => {
  it('signs pay v3 requests', async () => {
    let authorization = '';
    const client = new PayClient({
      appId: 'appid',
      mchId: 'mchid',
      serialNo: 'serial',
      privateKey: 'private-key',
      apiV3Key: '12345678901234567890123456789012',
      crypto: cryptoAdapter,
      fetch: async (_url, init) => {
        authorization = new Headers(init?.headers).get('authorization') ?? '';
        return new Response(JSON.stringify({ prepay_id: 'prepay' }), {
          headers: { 'content-type': 'application/json' }
        });
      }
    });

    const result = await client.transactionsJsapi({
      openid: 'openid',
      description: '测试订单',
      outTradeNo: 'order-1',
      notifyUrl: 'https://example.com/pay/notify',
      amount: {
        total: 1
      }
    });

    expect(result.prepay_id).toBe('prepay');
    expect(authorization).toContain('WECHATPAY2-SHA256-RSA2048');
    expect(authorization).toContain('mchid="mchid"');
    expect(authorization).toContain('serial_no="serial"');
  });

  it('decrypts pay notification resource', async () => {
    const client = new PayClient({
      appId: 'appid',
      mchId: 'mchid',
      serialNo: 'serial',
      privateKey: 'private-key',
      apiV3Key: '12345678901234567890123456789012',
      crypto: cryptoAdapter
    });

    await expect(
      client.decryptNotificationResource({
        algorithm: 'AEAD_AES_256_GCM',
        ciphertext: 'ciphertext',
        nonce: 'nonce'
      })
    ).resolves.toEqual({ ok: true });
  });
});
