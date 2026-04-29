import { createNodeCryptoAdapter } from '../src/adapters/node/index.js';
import { createPayClient } from '../src/pay/index.js';

const pay = createPayClient({
  appId: process.env.WECHAT_APP_ID ?? '',
  mchId: process.env.WECHAT_MCH_ID ?? '',
  serialNo: process.env.WECHAT_PAY_SERIAL_NO ?? '',
  privateKey: process.env.WECHAT_PAY_PRIVATE_KEY ?? '',
  apiV3Key: process.env.WECHAT_PAY_API_V3_KEY ?? '',
  crypto: createNodeCryptoAdapter()
});

const transaction = await pay.transactionsJsapi({
  openid: 'openid',
  description: '测试订单',
  outTradeNo: `order-${Date.now()}`,
  notifyUrl: 'https://example.com/pay/notify',
  amount: { total: 1 }
});

console.log(await pay.createJsapiPaySign(transaction.prepay_id));
