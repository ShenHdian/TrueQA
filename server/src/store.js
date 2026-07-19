// 极简 JSON 文件存储（开发/单机用）。已加固：原子写 + 备份 + 损坏恢复。
// 约定：db 仅在进程启动时由 index.js 读入内存（let db = read()），后续读写都操作内存对象，
// write(db) 仅把内存快照落盘。因此并发 read-modify-write 在单进程内天然无竞态。
// 生产多实例 / 高并发（如 P3 西部对战）建议替换为 SQLite，见 plan/持久化方案.md。
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const TMP_FILE = path.join(DATA_DIR, 'db.json.tmp');
const BAK_FILE = path.join(DATA_DIR, 'db.json.bak');

const defaultDb = { users: {}, questions: [], tokenIndex: {} };

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function isCorrupt(buf) {
  try {
    JSON.parse(buf);
    return false;
  } catch (e) {
    return true;
  }
}

// 启动时调用一次。主文件损坏则回退备份，备份也坏则初始化默认（并打印告警，不静默丢数据）。
function read() {
  ensure();
  if (fs.existsSync(DB_FILE)) {
    const buf = fs.readFileSync(DB_FILE, 'utf-8');
    if (!isCorrupt(buf)) return JSON.parse(buf);
    console.warn('[store] db.json 解析失败，尝试从备份恢复');
  }
  if (fs.existsSync(BAK_FILE)) {
    const buf = fs.readFileSync(BAK_FILE, 'utf-8');
    if (!isCorrupt(buf)) {
      fs.writeFileSync(DB_FILE, buf); // 用完好的备份修复主文件
      console.warn('[store] 已从 db.json.bak 恢复');
      return JSON.parse(buf);
    }
  }
  // 主文件和备份都不可用：重新初始化默认库
  const init = JSON.stringify(defaultDb, null, 2);
  fs.writeFileSync(DB_FILE, init);
  console.warn('[store] db.json 缺失/损坏且无可用备份，已初始化为默认库');
  return JSON.parse(JSON.stringify(defaultDb));
}

// 原子写：写临时文件 → （主文件完好时）备份当前版本 → rename 覆盖。
// rename 在同卷内是原子操作，不会出现“写一半的半截文件”，崩溃最多回退到上一版。
function write(db) {
  ensure();
  const text = JSON.stringify(db, null, 2);
  fs.writeFileSync(TMP_FILE, text);
  if (fs.existsSync(DB_FILE) && !isCorrupt(fs.readFileSync(DB_FILE, 'utf-8'))) {
    fs.copyFileSync(DB_FILE, BAK_FILE); // 仅当主文件完好才备份，避免把损坏版存成备份
  }
  fs.renameSync(TMP_FILE, DB_FILE);
}

module.exports = { read, write, defaultDb, DATA_DIR };
