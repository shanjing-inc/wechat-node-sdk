import { WechatCryptoError } from '../errors/index.js';

export type AesGcmDecryptOptions = {
  key: string;
  nonce: string;
  ciphertext: string;
  associatedData?: string;
};

export interface CryptoAdapter {
  sha1(data: string): Promise<string>;
  hmacSha256(data: string, key: string): Promise<string>;
  rsaSha256Sign(data: string, privateKeyPem: string): Promise<string>;
  rsaSha256Verify(data: string, signatureBase64: string, publicKeyPem: string): Promise<boolean>;
  aes256GcmDecrypt(options: AesGcmDecryptOptions): Promise<string>;
  randomBytes(size: number): Uint8Array;
}

export class WebCryptoAdapter implements CryptoAdapter {
  async sha1(data: string): Promise<string> {
    const digest = await subtle().digest('SHA-1', utf8Buffer(data));
    return bytesToHex(new Uint8Array(digest));
  }

  async hmacSha256(data: string, key: string): Promise<string> {
    const cryptoKey = await subtle().importKey(
      'raw',
      utf8Buffer(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await subtle().sign('HMAC', cryptoKey, utf8Buffer(data));
    return bytesToBase64(new Uint8Array(signature));
  }

  async rsaSha256Sign(data: string, privateKeyPem: string): Promise<string> {
    try {
      const key = await subtle().importKey(
        'pkcs8',
        toArrayBuffer(pemToBytes(privateKeyPem)),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await subtle().sign('RSASSA-PKCS1-v1_5', key, utf8Buffer(data));
      return bytesToBase64(new Uint8Array(signature));
    } catch (error) {
      throw new WechatCryptoError('RSA-SHA256 签名失败', error);
    }
  }

  async rsaSha256Verify(data: string, signatureBase64: string, publicKeyPem: string): Promise<boolean> {
    try {
      const key = await subtle().importKey(
        'spki',
        toArrayBuffer(pemToBytes(publicKeyPem)),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );

      return subtle().verify(
        'RSASSA-PKCS1-v1_5',
        key,
        toArrayBuffer(base64ToBytes(signatureBase64)),
        utf8Buffer(data)
      );
    } catch (error) {
      throw new WechatCryptoError('RSA-SHA256 验签失败', error);
    }
  }

  async aes256GcmDecrypt(options: AesGcmDecryptOptions): Promise<string> {
    try {
      const key = await subtle().importKey('raw', utf8Buffer(options.key), 'AES-GCM', false, ['decrypt']);
      const algorithm: AesGcmParams = {
        name: 'AES-GCM',
        iv: utf8Buffer(options.nonce),
        tagLength: 128
      };

      if (options.associatedData !== undefined) {
        algorithm.additionalData = utf8Buffer(options.associatedData);
      }

      const plaintext = await subtle().decrypt(
        algorithm,
        key,
        toArrayBuffer(base64ToBytes(options.ciphertext))
      );

      return new TextDecoder().decode(plaintext);
    } catch (error) {
      throw new WechatCryptoError('AES-256-GCM 解密失败', error);
    }
  }

  randomBytes(size: number): Uint8Array {
    const bytes = new Uint8Array(size);
    crypto().getRandomValues(bytes);
    return bytes;
  }
}

export function createWebCryptoAdapter(): CryptoAdapter {
  return new WebCryptoAdapter();
}

export function utf8(data: string): Uint8Array {
  return new TextEncoder().encode(data);
}

export function utf8Buffer(data: string): ArrayBuffer {
  return toArrayBuffer(utf8(data));
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((item) => item.toString(16).padStart(2, '0')).join('');
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function pemToBytes(pem: string): Uint8Array {
  const base64 = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
  return base64ToBytes(base64);
}

function subtle(): SubtleCrypto {
  const api = crypto().subtle;

  if (api === undefined) {
    throw new WechatCryptoError('当前运行环境缺少 Web Crypto subtle API');
  }

  return api;
}

function crypto(): Crypto {
  if (globalThis.crypto === undefined) {
    throw new WechatCryptoError('当前运行环境缺少 Web Crypto API');
  }

  return globalThis.crypto;
}
