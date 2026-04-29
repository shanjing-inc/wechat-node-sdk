import {
  type AesGcmDecryptOptions,
  type CryptoAdapter
} from '../../core/crypto/index.js';
import { WechatCryptoError } from '../../core/errors/index.js';

export class NodeCryptoAdapter implements CryptoAdapter {
  async sha1(data: string): Promise<string> {
    const { createHash } = await import('node:crypto');
    return createHash('sha1').update(data).digest('hex');
  }

  async hmacSha256(data: string, key: string): Promise<string> {
    const { createHmac } = await import('node:crypto');
    return createHmac('sha256', key).update(data).digest('base64');
  }

  async rsaSha256Sign(data: string, privateKeyPem: string): Promise<string> {
    const { createSign } = await import('node:crypto');

    try {
      return createSign('RSA-SHA256').update(data).sign(privateKeyPem, 'base64');
    } catch (error) {
      throw new WechatCryptoError('Node RSA-SHA256 签名失败', error);
    }
  }

  async rsaSha256Verify(data: string, signatureBase64: string, publicKeyPem: string): Promise<boolean> {
    const { createVerify } = await import('node:crypto');

    try {
      return createVerify('RSA-SHA256').update(data).verify(publicKeyPem, signatureBase64, 'base64');
    } catch (error) {
      throw new WechatCryptoError('Node RSA-SHA256 验签失败', error);
    }
  }

  async aes256GcmDecrypt(options: AesGcmDecryptOptions): Promise<string> {
    const { createDecipheriv } = await import('node:crypto');

    try {
      const encrypted = Buffer.from(options.ciphertext, 'base64');
      const authTag = encrypted.subarray(encrypted.length - 16);
      const data = encrypted.subarray(0, encrypted.length - 16);
      const decipher = createDecipheriv(
        'aes-256-gcm',
        Buffer.from(options.key, 'utf8'),
        Buffer.from(options.nonce, 'utf8')
      );

      if (options.associatedData !== undefined) {
        decipher.setAAD(Buffer.from(options.associatedData, 'utf8'));
      }

      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch (error) {
      throw new WechatCryptoError('Node AES-256-GCM 解密失败', error);
    }
  }

  randomBytes(size: number): Uint8Array {
    const crypto = globalThis.crypto;

    if (crypto !== undefined) {
      const bytes = new Uint8Array(size);
      crypto.getRandomValues(bytes);
      return bytes;
    }

    throw new WechatCryptoError('当前 Node 环境缺少 globalThis.crypto');
  }
}

export function createNodeCryptoAdapter(): CryptoAdapter {
  return new NodeCryptoAdapter();
}
