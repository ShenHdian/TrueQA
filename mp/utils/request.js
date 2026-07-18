// 统一请求层：Promise 化 + 鉴权头 + 401 自动重新登录重试
const { BASE_URL } = require('../config');

const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('access_token');
    wx.request({
      url: BASE_URL + options.url,
      method: (options.method || 'GET').toUpperCase(),
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? 'Bearer ' + token : '',
        ...(options.header || {}),
      },
      success: (res) => {
        if (res.statusCode === 401) {
          wx.removeStorageSync('access_token');
          return refreshAndRetry(options).then(resolve).catch(reject);
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data || {};
          if (body.code === 0 || body.code === undefined) {
            resolve(body.data !== undefined ? body.data : body);
          } else {
            reject(body);
          }
        } else {
          reject({ code: res.statusCode, message: (res.data && res.data.message) || 'request failed' });
        }
      },
      fail: (err) => reject({ code: -1, message: 'network error', detail: err }),
    });
  });
};

function refreshAndRetry(options) {
  const { login } = require('./auth');
  return login().then(() => request(options));
}

module.exports = { request };
