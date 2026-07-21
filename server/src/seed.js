// 系统题种子：写入 SQLite（幂等，INSERT OR IGNORE）。
// 读取 server/data/seed-questions.json（已入库，随 CI 部署到服务器），
// 缺失时回退内置 30 题，解决“系统题库上不去 / 线上空题库”问题。
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SEED_FILE = path.join(DATA_DIR, 'seed-questions.json');

// 兜底内置（防止种子文件缺失导致完全没有系统题）
const FALLBACK = [
  { id: 'sys-1', content: '你认为一段关系里最重要的是什么？', anger: 5 },
  { id: 'sys-2', content: '有人当众让你下不来台，你会当场回击还是事后算账？', anger: 7 },
  { id: 'sys-3', content: '你愿意为了喜欢的城市放弃现在的工作吗？', anger: 4 },
  { id: 'sys-4', content: '朋友借钱不还，你还会借第二次吗？', anger: 6 },
  { id: 'sys-5', content: '你更看重多赚钱还是活得舒服？', anger: 5 },
  { id: 'sys-6', content: '原则冲突时，你会坚持底线还是适当妥协？', anger: 6 },
  { id: 'sys-7', content: '你最不能容忍伴侣的哪种行为？', anger: 7 },
  { id: 'sys-8', content: '重选一次专业，你还会选现在的吗？', anger: 4 },
  { id: 'sys-9', content: '在足够大的利益面前，你会出卖朋友吗？', anger: 8 },
  { id: 'sys-10', content: '你如何定义“成功”？', anger: 4 },
];

function clampAnger(v) {
  let n = Number(v);
  if (isNaN(n)) n = 5;
  return Math.max(0, Math.min(10, Math.round(n)));
}

function loadSeedQuestions() {
  try {
    if (fs.existsSync(SEED_FILE)) {
      const arr = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch (e) {
    console.warn('[seed] 读取 seed-questions.json 失败，回退内置题：', e.message);
  }
  return FALLBACK;
}

// 向 SQLite 写入系统题（幂等：相同 id 不重复插入）
function seedSql(db) {
  const seeds = loadSeedQuestions();
  const ins = db.prepare(
    'INSERT OR IGNORE INTO questions (id, content, anger, source, owner_openid, created_at) VALUES (?,?,?,?,?,?)'
  );
  let added = 0;
  for (const s of seeds) {
    if (!s || !s.id || !s.content) continue;
    const r = ins.run(s.id, String(s.content).trim(), clampAnger(s.anger), 'system', '', Date.now());
    if (r && r.changes > 0) added++;
  }
  if (added) console.log(`[seed] 系统题已写入 ${added} 道`);
}

module.exports = { seedSql, loadSeedQuestions };
