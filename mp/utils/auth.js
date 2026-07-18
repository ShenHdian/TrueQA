// 登录与登录态管理
const { request } = require('./request');

const login = () => {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        request({ url: '/auth/wechat-login', method: 'POST', data: { code: res.code } })
          .then((data) => {
            wx.setStorageSync('access_token', data.access_token);
            wx.setStorageSync('user', data.user);
            const app = getApp();
            if (app) {
              app.globalData.token = data.access_token;
              app.globalData.userInfo = data.user;
            }
            resolve(data.user);
          })
          .catch(reject);
      },
      fail: (e) => reject(e),
    });
  });
};

// 确保有登录态：有 token 直接返回，无则走登录
const ensureLogin = () => {
  const token = wx.getStorageSync('access_token');
  if (token) return Promise.resolve(token);
  return login();
};

const getProfile = () => wx.getStorageSync('user') || null;

module.exports = { login, ensureLogin, getProfile };
