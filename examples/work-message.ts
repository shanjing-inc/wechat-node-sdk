import { createWorkClient } from '../src/work/index.js';

const work = createWorkClient({
  corpId: process.env.WECHAT_WORK_CORP_ID ?? '',
  corpSecret: process.env.WECHAT_WORK_CORP_SECRET ?? ''
});

await work.sendMessage({
  touser: '@all',
  msgtype: 'text',
  agentid: Number(process.env.WECHAT_WORK_AGENT_ID ?? 0),
  text: {
    content: 'hello from wechat-node-sdk'
  }
});
