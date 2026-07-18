#!/usr/bin/env node
// 微信小程序 CI 上传脚本（官方 miniprogram-ci）
// 用法: node scripts/ci-miniprogram.js [preview|upload]
//
// 环境变量:
//   WX_APPID            小程序真实 AppID
//   WX_PRIVATE_KEY      上传密钥 pem 文本内容（推荐用 CI Secret 注入）；或
//   WX_PRIVATE_KEY_PATH 密钥文件路径
//   PROJECT_PATH        小程序目录，默认 ./mp
//   VERSION             上传版本号（upload 时），默认 1.0.0
//   ROBOT               机器人编号 1-30，默认 1（多 CI 并发上传时区分）
//
// preview -> 生成 preview.png 二维码，用微信扫一扫即可真机预览
// upload  -> 上传为「体验版」（仍需在 MP 后台手动提交审核）

const fs = require('fs');
const path = require('path');
const ci = require('miniprogram-ci');

const mode = process.argv[2] || process.env.CI_MODE || 'preview';
const appid = process.env.WX_APPID;
const projectPath = path.resolve(process.env.PROJECT_PATH || './mp');

if (!appid) {
  console.error('[CI] 缺少环境变量 WX_APPID');
  process.exit(1);
}

// 私钥：优先用文件，否则把 Secret 里的文本落盘为临时文件
let privateKeyPath = process.env.WX_PRIVATE_KEY_PATH;
if (!privateKeyPath && process.env.WX_PRIVATE_KEY) {
  privateKeyPath = path.join(__dirname, '.ci-private.key');
  fs.writeFileSync(privateKeyPath, process.env.WX_PRIVATE_KEY);
}
if (!privateKeyPath) {
  console.error('[CI] 缺少 WX_PRIVATE_KEY 或 WX_PRIVATE_KEY_PATH');
  process.exit(1);
}

const project = new ci.Project({
  appid,
  type: 'miniProgram',
  projectPath,
  privateKeyPath,
  // 上传时排除与小程序运行时无关的内容，减小包体
  ignores: [
    'node_modules/**/*',
    'scripts/**/*',
    'web/**/*',
    'server/**/*',
    'plan/**/*',
    '.github/**/*',
  ],
});

const setting = { es6: true, minified: true, postcss: true };

(async () => {
  if (mode === 'upload') {
    const version = process.env.VERSION || '1.0.0';
    const res = await ci.upload({
      project,
      version,
      desc: `CI upload ${new Date().toISOString().slice(0, 19)}`,
      setting,
      robot: Number(process.env.ROBOT || 1),
    });
    console.log('[CI] upload 完成:', JSON.stringify(res));
  } else {
    const out = path.join(__dirname, 'preview.png');
    const res = await ci.preview({
      project,
      desc: 'CI preview',
      setting,
      qrcodeFormat: 'image',
      qrcodeOutputDest: out,
      robot: Number(process.env.ROBOT || 1),
    });
    console.log('[CI] preview 二维码已生成 ->', out, JSON.stringify(res));
  }
})().catch((e) => {
  console.error('[CI] 失败:', e);
  process.exit(1);
});
