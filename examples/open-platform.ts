import { createOpenPlatformClient } from '../src/open-platform/index.js';

const openPlatform = createOpenPlatformClient({
  appId: process.env.WECHAT_OPEN_APP_ID ?? '',
  appSecret: process.env.WECHAT_OPEN_APP_SECRET ?? '',
  componentVerifyTicket: process.env.WECHAT_OPEN_COMPONENT_VERIFY_TICKET ?? ''
});

const preAuthCode = await openPlatform.createPreAuthCode();
console.log(preAuthCode.pre_auth_code);
