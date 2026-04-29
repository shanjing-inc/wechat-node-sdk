import { createOpenWorkClient } from '../src/open-work/index.js';

const openWork = createOpenWorkClient({
  suiteId: process.env.WECHAT_WORK_SUITE_ID ?? '',
  suiteSecret: process.env.WECHAT_WORK_SUITE_SECRET ?? '',
  suiteTicket: process.env.WECHAT_WORK_SUITE_TICKET ?? ''
});

const preAuthCode = await openWork.getPreAuthCode();
console.log(preAuthCode.pre_auth_code);
