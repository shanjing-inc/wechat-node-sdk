import {
  createWebCryptoAdapter,
  type CryptoAdapter
} from '../../core/crypto/index.js';

export function createDenoCryptoAdapter(): CryptoAdapter {
  return createWebCryptoAdapter();
}
