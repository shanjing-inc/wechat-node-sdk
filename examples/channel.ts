import { createChannelClient } from '../src/channel/index.js';

const channel = createChannelClient({
  appId: process.env.WECHAT_APP_ID ?? '',
  appSecret: process.env.WECHAT_APP_SECRET ?? ''
});

const info = await channel.getBasicsInfo();
console.log(info);
