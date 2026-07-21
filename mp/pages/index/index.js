const { getRandom } = require('../../services/question');
const { ensureLogin } = require('../../utils/auth');

Page({
  data: {
    trigger: 0,
    spinning: false,
    flipped: false,
    question: null,
    sourceLabel: '',
  },

  onLoad() {
    ensureLogin().catch(() => {});
  },

  onDraw() {
    if (this.data.spinning) return;
    this.setData({ spinning: true, flipped: false, question: null });
    this.setData({ trigger: this.data.trigger + 1 });
  },

  onSlotDone() {
    getRandom()
      .then((q) => {
        this.setData({
          question: q,
          sourceLabel: q.source === 'user' ? '我的题' : '系统题',
          spinning: false,
          flipped: true,
        });
      })
      .catch(() => {
        wx.showToast({ title: '抽取失败', icon: 'none' });
        this.setData({ spinning: false });
      });
  },

});
