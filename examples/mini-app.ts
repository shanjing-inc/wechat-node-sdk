import { createMiniAppClient } from '../src/mini-app/index.js';

const miniApp = createMiniAppClient({
  appId: process.env.WECHAT_APP_ID ?? '',
  appSecret: process.env.WECHAT_APP_SECRET ?? ''
});

const session = await miniApp.code2Session('js_code');
console.log(session.openid);
