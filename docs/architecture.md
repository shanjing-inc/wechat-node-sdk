# 架构说明

## 模块边界

`core` 提供稳定基础设施：HTTP、缓存、配置校验、错误模型、Token 管理、XML、Crypto Adapter。业务模块只依赖这些抽象，后续扩展新接口时可以保持公共 API 风格一致。

已实现基础能力：

- `mini-app`：小程序 access token、`code2Session`、手机号、二维码基础接口
- `official-account`：公众号 access token、回调 IP、用户信息、自定义菜单基础接口
- `pay`：微信支付 API v3 请求签名、JSAPI 下单、订单查询、关单、支付参数签名、通知验签和资源解密
- `work`：企业微信 access token、通讯录读取、应用消息、应用信息、JSAPI ticket
- `open-platform`：开放平台 component access token、预授权码、授权查询、授权方信息、授权方 token 刷新
- `open-work`：企业微信开放平台 suite access token、预授权码、永久授权码、授权企业 token
- `channel`：视频号 access token、基础信息、订单列表、订单详情

## 运行环境

SDK 主体使用 Web 标准 API，包括 `fetch`、`URL`、`Headers`、`TextEncoder`、`TextDecoder`、Web Crypto。Node 专属能力集中在 `adapters/node` 子路径，普通 Web/SSR 构建可以按需避开 Node builtin。

## 发布策略

包采用 ESM first 和 `exports` 子路径。推荐外部用户从业务子路径导入：

```ts
import { createMiniAppClient } from '@shanjing/wechat-node-sdk/mini-app';
```

这样能减少跨模块依赖被打包器提前解析的概率。

## 代码来源

当前实现为原创 TypeScript 实现。后续如果引入第三方 MIT 代码片段，需要在对应源码附近保留版权说明，并把原始 LICENSE 放入仓库。

## 扩展规则

新增接口优先使用业务模块的 `requestWith...Token` 方法封装。接口返回结构尚未稳定时，公共方法可以先返回 `unknown`，等测试和真实项目接入后再收窄类型。
