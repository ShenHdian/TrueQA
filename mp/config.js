// 环境配置：本地联调时开发者工具需勾选「不校验合法域名」
// 真机/提审前：把 BASE_URL / WS_URL 改为已备案 HTTPS 域名并在 MP 后台配置服务器域名白名单
module.exports = {
  ENV: 'dev',
  // 本地后端地址（Node 服务默认 3000 端口）
  BASE_URL: 'http://127.0.0.1:3000/api',
  WS_URL: 'ws://127.0.0.1:3000',
  // 真机示例（替换为你自己的域名）：
  // BASE_URL: 'https://api.your-domain.com/api',
  // WS_URL: 'wss://api.your-domain.com',
};
