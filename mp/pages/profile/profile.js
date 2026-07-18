const { ensureLogin, getProfile, login } = require('../../utils/auth');

Page({
  data: {
    nick: '',
    avatar: '',
    level: 1,
    exp: 0,
    hpBase: 20,
    logged: false,
    expPercent: 0,
    nextExp: 100,
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const u = getProfile();
    if (u) {
      const next = u.level * 100;
      this.setData({
        nick: u.nick,
        avatar: u.avatar,
        level: u.level,
        exp: u.exp,
        hpBase: u.hp_base,
        logged: true,
        nextExp: next,
        expPercent: Math.min(100, Math.round((u.exp / next) * 100)),
      });
    } else {
      this.setData({ logged: false });
    }
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.saveProfile({ avatar: avatarUrl });
    this.setData({ avatar: avatarUrl });
  },

  onNick(e) {
    const nick = e.detail.value;
    this.saveProfile({ nick });
    this.setData({ nick });
  },

  saveProfile(patch) {
    const u = getProfile() || {};
    const merged = { ...u, ...patch };
    wx.setStorageSync('user', merged);
    const app = getApp();
    if (app) app.globalData.userInfo = merged;
  },

  reLogin() {
    login()
      .then(() => this.refresh())
      .catch(() => wx.showToast({ title: '登录失败', icon: 'none' }));
  },
});
