// 环境配置
// 微信小程序用 envVersion 自动区分运行环境，无需手动切换、也无需构建注入：
//   develop -> 开发者工具 / 开发版（本地后端，需勾选「不校验合法域名」）
//   trial   -> 体验版（CI 预览/上传出来的包，扫码真机即用）
//   release -> 正式版（提审发布后）
// 真机（trial/release）要让后端可达，BASE_URL 必须是「已备案 HTTPS 域名」，
// 并在 MP 后台「服务器域名」登记 request 合法域名 + socket 合法域名。

function resolveEnv() {
  try {
    const v = wx.getAccountInfoSync().miniProgram.envVersion;
    if (v === 'develop' || v === 'trial' || v === 'release') return v;
  } catch (e) {
    // 取不到时兜底为开发环境（本地联调）
  }
  return 'develop';
}

const ENV = resolveEnv();

// 本地开发（开发者工具、urlCheck:false 时）
const LOCAL = {
  BASE_URL: 'http://127.0.0.1:3000/api',
  WS_URL: 'ws://127.0.0.1:3000',
};

// 体验版 / 正式版（真机）-> 已备案 HTTPS 域名，后端经 Nginx 反代到 :3000
const PROD = {
  BASE_URL: 'https://trueqa.shenhdou.asia/api',
  WS_URL: 'wss://trueqa.shenhdou.asia',
};

const IS_DEV = ENV === 'develop';

module.exports = {
  ENV,
  IS_DEV,
  BASE_URL: IS_DEV ? LOCAL.BASE_URL : PROD.BASE_URL,
  WS_URL: IS_DEV ? LOCAL.WS_URL : PROD.WS_URL,
};
