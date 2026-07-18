Page({
  data: {},
  onCreate() {
    wx.showToast({ title: '对战模式开发中（P3）', icon: 'none' });
  },
  onShareAppMessage() {
    return {
      title: '来跟我西部对战真心话！',
      path: '/pages/index/index',
    };
  },
});
