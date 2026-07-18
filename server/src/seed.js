// 系统题种子：10 道三观/价值观简答题，作普通弹兜底。可随时在后台修改。
const SYSTEM_QUESTIONS = [
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

function seed(db) {
  const has = db.questions.some((q) => q.source === 'system');
  if (!has) {
    SYSTEM_QUESTIONS.forEach((content, i) => {
      db.questions.push({
        id: 'sys-' + (i + 1),
        content,
        anger: 5,
        ai_reason: '',
        source: 'system',
        owner_openid: '',
        createdAt: Date.now(),
      });
    });
  }
  return db;
}

module.exports = { seed, SYSTEM_QUESTIONS };
