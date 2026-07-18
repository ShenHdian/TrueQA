const { login } = require('./utils/auth');

App({
  globalData: {
    userInfo: null,
    token: '',
  },

  onLaunch() {
    // 隐私协议授权（首次启动弹窗）
    if (typeof wx.requirePrivacyAuthorize === 'function') {
      wx.requirePrivacyAuthorize({
        success: () => {},
        fail: () => {},
      });
    }

    // 静默登录：有 token 复用，无则走微信登录换 session
    const token = wx.getStorageSync('access_token');
    if (token) {
      this.globalData.token = token;
      this.globalData.userInfo = wx.getStorageSync('user') || null;
    } else {
      login().catch(() => {
        // 登录失败不阻塞首屏，用户可在「我的」页手动登录
        console.warn('[app] silent login failed');
      });
    }
  },
});
