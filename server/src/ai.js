// AI 评分占位：首版不接大模型，返回默认怒气值 + 预留理由字段。
// 后续接入混元/OpenAI 时，仅替换本函数实现即可（入参 content，出参 { anger, reason }）。
function scoreAnger(content) {
  return {
    anger: 5,
    reason: 'AI 评分接口预留中（当前为占位值 5），请手动调整怒气值。',
  };
}

module.exports = { scoreAnger };
