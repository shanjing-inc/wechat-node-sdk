# @shanjing/wechat-node-sdk

现代 TypeScript 微信服务端 SDK。当前覆盖 `core`、`mini-app`、`official-account`、`pay`、`work`、`open-platform`、`open-work`、`channel` 的基础能力。

## 特性

- ESM first，支持 npm 子路径导出
- 原生 `fetch` HTTP 客户端
- Web Crypto 优先，Node crypto 通过 `@shanjing/wechat-node-sdk/adapters/node` 引入
- `CacheStore` 抽象，内置内存缓存
- `zod` 配置校验
- `fast-xml-parser` XML 解析和构建
- `vitest` 测试，`tsup` 构建

## 安装

```bash
pnpm add @shanjing/wechat-node-sdk
```

## 小程序

```ts
import { createMiniAppClient } from '@shanjing/wechat-node-sdk/mini-app';

const miniApp = createMiniAppClient({
  appId: process.env.WECHAT_APP_ID!,
  appSecret: process.env.WECHAT_APP_SECRET!
});

const session = await miniApp.code2Session('js_code');
```

## 公众号

```ts
import { createOfficialAccountClient } from '@shanjing/wechat-node-sdk/official-account';

const officialAccount = createOfficialAccountClient({
  appId: process.env.WECHAT_APP_ID!,
  appSecret: process.env.WECHAT_APP_SECRET!
});

const user = await officialAccount.getUserInfo('openid');
```

## 微信支付 API v3

```ts
import { createPayClient } from '@shanjing/wechat-node-sdk/pay';
import { createNodeCryptoAdapter } from '@shanjing/wechat-node-sdk/adapters/node';

const pay = createPayClient({
  appId: process.env.WECHAT_APP_ID!,
  mchId: process.env.WECHAT_MCH_ID!,
  serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
  privateKey: process.env.WECHAT_PAY_PRIVATE_KEY!,
  apiV3Key: process.env.WECHAT_PAY_API_V3_KEY!,
  crypto: createNodeCryptoAdapter()
});

const transaction = await pay.transactionsJsapi({
  openid: 'openid',
  description: '测试订单',
  outTradeNo: 'order-1',
  notifyUrl: 'https://example.com/pay/notify',
  amount: { total: 1 }
});

const jsapiParams = await pay.createJsapiPaySign(transaction.prepay_id);
```

## 企业微信

```ts
import { createWorkClient } from '@shanjing/wechat-node-sdk/work';

const work = createWorkClient({
  corpId: process.env.WECHAT_WORK_CORP_ID!,
  corpSecret: process.env.WECHAT_WORK_CORP_SECRET!
});

await work.sendMessage({
  touser: 'userid',
  msgtype: 'text',
  agentid: 1000001,
  text: { content: 'hello' }
});
```

## 微信开放平台

```ts
import { createOpenPlatformClient } from '@shanjing/wechat-node-sdk/open-platform';

const openPlatform = createOpenPlatformClient({
  appId: process.env.WECHAT_OPEN_APP_ID!,
  appSecret: process.env.WECHAT_OPEN_APP_SECRET!,
  componentVerifyTicket: async () => loadComponentVerifyTicket()
});

const preAuthCode = await openPlatform.createPreAuthCode();
```

## 企业微信开放平台

```ts
import { createOpenWorkClient } from '@shanjing/wechat-node-sdk/open-work';

const openWork = createOpenWorkClient({
  suiteId: process.env.WECHAT_WORK_SUITE_ID!,
  suiteSecret: process.env.WECHAT_WORK_SUITE_SECRET!,
  suiteTicket: async () => loadSuiteTicket()
});

const preAuthCode = await openWork.getPreAuthCode();
```

## 视频号

```ts
import { createChannelClient } from '@shanjing/wechat-node-sdk/channel';

const channel = createChannelClient({
  appId: process.env.WECHAT_APP_ID!,
  appSecret: process.env.WECHAT_APP_SECRET!
});

const info = await channel.getBasicsInfo();
```

## 开发

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

设计说明见 [docs/architecture.md](./docs/architecture.md)。
