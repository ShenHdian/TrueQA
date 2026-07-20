// 系统题种子：从 server/data/seed-questions.json 幂等合并进 db.json。
// 该文件已入库（不被 .gitignore 排除），会随 CI 部署到服务器，启动时自动合并，
// 解决“系统题库上不去 / 线上空题库”的问题。
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SEED_FILE = path.join(DATA_DIR, 'seed-questions.json');

// 兜底内置（防止种子文件缺失导致完全没有系统题）
const FALLBACK = [
  '你认为一段关系里最重要的是什么？',
  '有人当众让你下不来台，你会当场回击还是事后算账？',
  '你愿意为了喜欢的城市放弃现在的工作吗？',
  '朋友借钱不还，你还会借第二次吗？',
  '你更看重多赚钱还是活得舒服？',
  '原则冲突时，你会坚持底线还是适当妥协？',
  '你最不能容忍伴侣的哪种行为？',
  '重选一次专业，你还会选现在的吗？',
  '在足够大的利益面前，你会出卖朋友吗？',
  '你如何定义“成功”？',
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
    console.warn('[seed] 读取 seed-questions.json 失败，回退内置 10 题：', e.message);
  }
  return FALLBACK.map((content, i) => ({ id: 'sys-' + (i + 1), content, anger: 5, ai_reason: '' }));
}

function seed(db) {
  const seeds = loadSeedQuestions();
  const byId = new Map(db.questions.map((q) => [q.id, q]));
  let added = 0;
  let updated = 0;

  seeds.forEach((s) => {
    const anger = clampAnger(s.anger);
    const existing = byId.get(s.id);
    if (existing) {
      // 已存在：仅同步系统题的怒气值（不碰用户题、不覆盖内容）
      if (existing.source === 'system' && existing.anger !== anger) {
        existing.anger = anger;
        updated++;
      }
      return;
    }
    db.questions.push({
      id: s.id,
      content: String(s.content || '').trim(),
      anger,
      ai_reason: s.ai_reason || '',
      source: 'system',
      owner_openid: '',
      createdAt: Date.now(),
    });
    added++;
  });

  if (added || updated) {
    console.log(`[seed] 系统题已同步：新增 ${added} 道，更新怒气值 ${updated} 道`);
  }
  return db;
}

module.exports = { seed, loadSeedQuestions };
