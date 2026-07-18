// 题库服务
const { request } = require('../utils/request');

const getRandom = () => request({ url: '/questions/random' });
const listMine = () => request({ url: '/questions?mine=1' });
const add = (content, anger) => request({ url: '/questions', method: 'POST', data: { content, anger } });
const batchAdd = (items) => request({ url: '/questions/batch', method: 'POST', data: { items } });
const remove = (id) => request({ url: '/questions/' + id, method: 'DELETE' });
const update = (id, patch) => request({ url: '/questions/' + id, method: 'PUT', data: patch });
const aiScore = (content) => request({ url: '/ai/score', method: 'POST', data: { content } });

module.exports = { getRandom, listMine, add, batchAdd, remove, update, aiScore };
