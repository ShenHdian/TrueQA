// 真心话抽卡对战 · 后端服务（零依赖，纯 Node http）
// 本地运行：node src/index.js  （默认端口 3000）
const http = require('http');
const crypto = require('crypto');
const { read, write } = require('./store');
const { seed } = require('./seed');
const { scoreAnger } = require('./ai');

const PORT = process.env.PORT || 3000;

// 初始化 + 种子
let db = read();
db = seed(db);
write(db);

// ---------- 工具 ----------
function send(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function getUserByToken(token) {
  if (!token) return null;
  const openid = db.tokenIndex[token];
  return openid ? db.users[openid] : null;
}

function authUser(req) {
  const h = req.headers['authorization'] || '';
  const token = h.replace(/^Bearer\s+/i, '');
  return getUserByToken(token);
}

function publicUser(u) {
  if (!u) return null;
  const { token, ...rest } = u;
  return rest;
}

function genToken() {
  return 'tok_' + crypto.randomBytes(12).toString('hex');
}

function clampAnger(v) {
  let n = Number(v);
  if (isNaN(n)) n = 5;
  return Math.max(0, Math.min(10, Math.round(n)));
}

// ---------- 路由表 ----------
const routes = [];
function route(method, pattern, handler) {
  routes.push({ method, regex: new RegExp('^' + pattern + '$'), handler });
}

route('GET', '/api/health', async (req, res) => send(res, 200, { code: 0, data: { ok: true } }));

// 微信登录：code -> openid + session token
route('POST', '/api/auth/wechat-login', async (req, res) => {
  const { code } = req.body || {};
  if (!code) return send(res, 200, { code: 1, message: 'missing code' });

  let openid;
  if (process.env.WX_APPID && process.env.WX_SECRET) {
    try {
      const url =
        `https://api.weixin.qq.com/sns/jscode2session?appid=${process.env.WX_APPID}` +
        `&secret=${process.env.WX_SECRET}&js_code=${code}&grant_type=authorization_code`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.openid) openid = j.openid;
    } catch (e) {
      /* 失败则回退到 dev mock */
    }
  }
  if (!openid) {
    openid = 'dev_' + crypto.createHash('md5').update(String(code)).digest('hex').slice(0, 12);
  }

  if (!db.users[openid]) {
    db.users[openid] = {
      openid,
      nick: '微信用户',
      avatar: '',
      level: 1,
      exp: 0,
      hp_base: 20,
      createdAt: Date.now(),
    };
  }
  const token = genToken();
  db.users[openid].token = token;
  db.tokenIndex[token] = openid;
  write(db);
  send(res, 200, { code: 0, data: { access_token: token, user: publicUser(db.users[openid]) } });
});

// 随机抽题：优先用户自建题，无则系统题
route('GET', '/api/questions/random', async (req, res) => {
  const user = authUser(req);
  const myQs = db.questions.filter((q) => q.source === 'user' && q.owner_openid === (user ? user.openid : ''));
  const pool = myQs.length ? myQs : db.questions.filter((q) => q.source === 'system');
  if (pool.length === 0) return send(res, 200, { code: 1, message: 'no questions' });
  const q = pool[Math.floor(Math.random() * pool.length)];
  send(res, 200, { code: 0, data: q });
});

// 列表：?mine=1 仅看自己的
route('GET', '/api/questions', async (req, res) => {
  const user = authUser(req);
  const mine = req.url.includes('mine=1');
  let list = db.questions;
  if (mine && user) list = list.filter((q) => q.owner_openid === user.openid);
  send(res, 200, { code: 0, data: { list, total: list.length } });
});

// 手动添加
route('POST', '/api/questions', async (req, res) => {
  const user = authUser(req);
  if (!user) return send(res, 200, { code: 401, message: 'unauthorized' });
  const { content, anger } = req.body || {};
  if (!content || !String(content).trim()) return send(res, 200, { code: 1, message: 'empty content' });
  const q = {
    id: 'u_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    content: String(content).trim(),
    anger: clampAnger(anger),
    ai_reason: '',
    source: 'user',
    owner_openid: user.openid,
    createdAt: Date.now(),
  };
  db.questions.push(q);
  write(db);
  send(res, 200, { code: 0, data: q });
});

// 批量导入
route('POST', '/api/questions/batch', async (req, res) => {
  const user = authUser(req);
  if (!user) return send(res, 200, { code: 401, message: 'unauthorized' });
  const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
  const added = [];
  items.forEach((it) => {
    if (it && it.content && String(it.content).trim()) {
      added.push({
        id: 'u_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
        content: String(it.content).trim(),
        anger: clampAnger(it.anger),
        ai_reason: '',
        source: 'user',
        owner_openid: user.openid,
        createdAt: Date.now(),
      });
    }
  });
  db.questions.push(...added);
  write(db);
  send(res, 200, { code: 0, data: { added: added.length, list: added } });
});

// 删除（仅自己的）
route('DELETE', '/api/questions/([^/]+)', async (req, res, params) => {
  const user = authUser(req);
  if (!user) return send(res, 200, { code: 401, message: 'unauthorized' });
  const id = params[0];
  const idx = db.questions.findIndex((q) => q.id === id && q.owner_openid === user.openid);
  if (idx < 0) return send(res, 200, { code: 1, message: 'not found' });
  const [removed] = db.questions.splice(idx, 1);
  write(db);
  send(res, 200, { code: 0, data: removed });
});

// 修改（仅自己的）：可改 content / anger
route('PUT', '/api/questions/([^/]+)', async (req, res, params) => {
  const user = authUser(req);
  if (!user) return send(res, 200, { code: 401, message: 'unauthorized' });
  const id = params[0];
  const q = db.questions.find((x) => x.id === id && x.owner_openid === user.openid);
  if (!q) return send(res, 200, { code: 1, message: 'not found' });
  const { content, anger } = req.body || {};
  if (content !== undefined) {
    const c = String(content).trim();
    if (!c) return send(res, 200, { code: 1, message: 'empty content' });
    if (c !== q.content) q.ai_reason = ''; // 题目变了，旧的 AI 评分依据作废
    q.content = c;
  }
  if (anger !== undefined) q.anger = clampAnger(anger);
  write(db);
  send(res, 200, { code: 0, data: q });
});

// AI 评分占位
route('POST', '/api/ai/score', async (req, res) => {
  const { content } = req.body || {};
  const r = scoreAnger(content);
  send(res, 200, { code: 0, data: r });
});

// ---------- HTTP 服务 ----------
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = req.url.split('?')[0];
  const body = (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') ? await readBody(req) : {};
  req.body = body;
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = url.match(r.regex);
    if (m) {
      try {
        await r.handler(req, res, m.slice(1));
      } catch (e) {
        send(res, 500, { code: 500, message: String((e && e.message) || e) });
      }
      return;
    }
  }
  send(res, 404, { code: 404, message: 'not found' });
});

server.listen(PORT, () => {
  console.log('[truth-or-dare] server listening on http://localhost:' + PORT);
});
