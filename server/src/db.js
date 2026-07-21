// 存储层：Node 内置 node:sqlite（零依赖，无需 npm install）。
// 建表 + 启动时一次性迁移遗留 JSON（db.json），避免从 JSON 切换到 SQLite 时丢失线上用户题。
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'trueqa.db');

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL;');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    openid      TEXT PRIMARY KEY,
    nick        TEXT DEFAULT '微信用户',
    avatar      TEXT DEFAULT '',
    level       INTEGER DEFAULT 1,
    exp         INTEGER DEFAULT 0,
    token       TEXT DEFAULT '',
    created_at  INTEGER
  );
  CREATE TABLE IF NOT EXISTS questions (
    id           TEXT PRIMARY KEY,
    content      TEXT NOT NULL,
    anger        INTEGER DEFAULT 5,
    source       TEXT DEFAULT 'user',
    owner_openid TEXT DEFAULT '',
    created_at   INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_q_owner  ON questions(owner_openid);
  CREATE INDEX IF NOT EXISTS idx_q_source ON questions(source);
`);

// 一次性迁移：questions 表为空且磁盘有遗留 db.json → 将其 users/questions 按 id upsert 进 SQLite。
// 迁移完成后把 db.json 重命名为 db.json.migrated，避免下次启动重复迁移。
function migrateFromJson() {
  const legacy = path.join(DATA_DIR, 'db.json');
  if (!fs.existsSync(legacy)) return;

  let count = 0;
  try {
    count = db.prepare('SELECT COUNT(*) AS c FROM questions').get().c;
  } catch (e) {
    count = 0;
  }
  if (count > 0) {
    // 已有数据，不重复迁移，直接归档遗留文件
    try { fs.renameSync(legacy, legacy + '.migrated'); } catch (e) {}
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(legacy, 'utf-8'));
    const users = data.users || {};
    const upsertUser = db.prepare(
      'INSERT OR REPLACE INTO users (openid, nick, avatar, level, exp, token, created_at) VALUES (?,?,?,?,?,?,?)'
    );
    for (const [openid, u] of Object.entries(users)) {
      upsertUser.run(
        openid,
        (u && u.nick) || '微信用户',
        (u && u.avatar) || '',
        (u && u.level) || 1,
        (u && u.exp) || 0,
        (u && u.token) || '',
        (u && u.createdAt) || Date.now()
      );
    }

    const questions = data.questions || [];
    const insQ = db.prepare(
      'INSERT OR IGNORE INTO questions (id, content, anger, source, owner_openid, created_at) VALUES (?,?,?,?,?,?)'
    );
    let n = 0;
    for (const q of questions) {
      if (!q || !q.id || !q.content) continue;
      insQ.run(q.id, String(q.content), q.anger == null ? 5 : q.anger, q.source || 'user', q.owner_openid || '', q.createdAt || Date.now());
      n++;
    }
    console.log(`[db] 已从遗留 db.json 迁移 ${Object.keys(users).length} 用户 / ${n} 题目`);
    fs.renameSync(legacy, legacy + '.migrated');
  } catch (e) {
    console.warn('[db] 迁移 db.json 失败（不影响启动）：', e.message);
  }
}

module.exports = { db, migrateFromJson };
