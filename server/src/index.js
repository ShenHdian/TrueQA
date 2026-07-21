// 真心话抽卡 · 后端服务（零依赖：纯 http + Node 内置 node:sqlite）
// 本地运行：node src/index.js  （默认端口 3000）
const http = require('http');
const crypto = require('crypto');
const { db, migrateFromJson } = require('./db');
const { seedSql } = require('./seed');
const { checkText } = require('./wechat');

const PORT = process.env.PORT || 3000;

// 初始化：迁移遗留 JSON（如有）→ 写入系统题种子
migrateFromJson();
seedSql(db);

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

function authUser(req) {
  const h = req.headers['authorization'] || '';
  const token = h.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const row = db.prepare('SELECT openid FROM users WHERE token = ?').get(token);
  if (!row) return null;
  return db.prepare('SELECT openid, nick, avatar, level, exp FROM users WHERE openid = ?').get(row.openid);
}

function publicUser(u) {
  if (!u) return null;
  return { openid: u.openid, nick: u.nick, avatar: u.avatar, level: u.level, exp: u.exp };
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

  const token = genToken();
  const existing = db.prepare('SELECT openid FROM users WHERE openid = ?').get(openid);
  if (existing) {
    db.prepare('UPDATE users SET token = ?, created_at = COALESCE(created_at, ?) WHERE openid = ?').run(token, Date.now(), openid);
  } else {
    db.prepare('INSERT INTO users (openid, nick, avatar, level, exp, token, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(openid, '微信用户', '', 1, 0, token, Date.now());
  }
  const user = db.prepare('SELECT openid, nick, avatar, level, exp FROM users WHERE openid = ?').get(openid);
  send(res, 200, { code: 0, data: { access_token: token, user: publicUser(user) } });
});

// 随机抽题：优先用户自建题，无则系统题
route('GET', '/api/questions/random', async (req, res) => {
  const user = authUser(req);
  const myQs = db.prepare("SELECT * FROM questions WHERE source = 'user' AND owner_openid = ?").all(user ? user.openid : '');
  const pool = myQs.length ? myQs : db.prepare("SELECT * FROM questions WHERE source = 'system'").all();
  if (pool.length === 0) return send(res, 200, { code: 1, message: 'no questions' });
  const q = pool[Math.floor(Math.random() * pool.length)];
  send(res, 200, { code: 0, data: q });
});

// 列表：?mine=1 仅看自己的；否则只返回系统题（不泄露其他用户的私有题库）
route('GET', '/api/questions', async (req, res) => {
  const user = authUser(req);
  const mine = req.url.includes('mine=1');
  const list = mine && user
    ? db.prepare('SELECT * FROM questions WHERE owner_openid = ?').all(user.openid)
    : db.prepare("SELECT * FROM questions WHERE source = 'system'").all();
  send(res, 200, { code: 0, data: { list, total: list.length } });
});

// 手动添加
route('POST', '/api/questions', async (req, res) => {
  const user = authUser(req);
  if (!user) return send(res, 200, { code: 401, message: 'unauthorized' });
  const { content, anger } = req.body || {};
  const text = content ? String(content).trim() : '';
  if (!text) return send(res, 200, { code: 1, message: 'empty content' });
  // UGC 内容安全审核
  const c = await checkText(text, user.openid);
  if (!c.ok) return send(res, 200, { code: 2, message: c.reason || '内容不合规，请修改后重试' });
  const id = 'u_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  db.prepare('INSERT INTO questions (id, content, anger, source, owner_openid, created_at) VALUES (?,?,?,?,?,?)')
    .run(id, text, clampAnger(anger), 'user', user.openid, Date.now());
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
  send(res, 200, { code: 0, data: q });
});

// 批量导入
route('POST', '/api/questions/batch', async (req, res) => {
  const user = authUser(req);
  if (!user) return send(res, 200, { code: 401, message: 'unauthorized' });
  const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
  const added = [];
  const blocked = [];
  const ins = db.prepare('INSERT INTO questions (id, content, anger, source, owner_openid, created_at) VALUES (?,?,?,?,?,?)');
  for (const it of items) {
    const text = it && it.content ? String(it.content).trim() : '';
    if (!text) continue;
    const c = await checkText(text, user.openid);
    if (!c.ok) {
      blocked.push(text.slice(0, 20));
      continue;
    }
    const id = 'u_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    ins.run(id, text, clampAnger(it.anger), 'user', user.openid, Date.now());
    added.push({ id, content: text, anger: clampAnger(it.anger) });
  }
  if (blocked.length) {
    return send(res, 200, {
      code: 2,
      message: `已导入 ${added.length} 条，拦截 ${blocked.length} 条不合规内容`,
      data: { added: added.length, blocked: blocked.length, blockedSamples: blocked },
    });
  }
  send(res, 200, { code: 0, data: { added: added.length, list: added } });
});

// 删除（仅自己的）
route('DELETE', '/api/questions/([^/]+)', async (req, res, params) => {
  const user = authUser(req);
  if (!user) return send(res, 200, { code: 401, message: 'unauthorized' });
  const id = params[0];
  const info = db.prepare('SELECT id FROM questions WHERE id = ? AND owner_openid = ?').get(id, user.openid);
  if (!info) return send(res, 200, { code: 1, message: 'not found' });
  db.prepare('DELETE FROM questions WHERE id = ?').run(id);
  send(res, 200, { code: 0, data: { id } });
});

// 修改（仅自己的）：可改 content / anger
route('PUT', '/api/questions/([^/]+)', async (req, res, params) => {
  const user = authUser(req);
  if (!user) return send(res, 200, { code: 401, message: 'unauthorized' });
  const id = params[0];
  const q = db.prepare('SELECT * FROM questions WHERE id = ? AND owner_openid = ?').get(id, user.openid);
  if (!q) return send(res, 200, { code: 1, message: 'not found' });
  const { content, anger } = req.body || {};
  if (content !== undefined) {
    const c = String(content).trim();
    if (!c) return send(res, 200, { code: 1, message: 'empty content' });
    db.prepare('UPDATE questions SET content = ? WHERE id = ?').run(c, id);
  }
  if (anger !== undefined) db.prepare('UPDATE questions SET anger = ? WHERE id = ?').run(clampAnger(anger), id);
  const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
  send(res, 200, { code: 0, data: updated });
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
