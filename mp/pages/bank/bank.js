const { listMine, add, batchAdd, remove } = require('../../services/question');

Page({
  data: {
    list: [],
    total: 0,
    showAdd: false,
    newContent: '',
    newAnger: 5,
    showImport: false,
    pasteText: '',
    importRows: [],
  },

  onShow() {
    this.loadMine();
  },

  loadMine() {
    listMine()
      .then(({ list }) => this.setData({ list, total: list.length }))
      .catch(() => {});
  },

  toggleAdd() {
    this.setData({ showAdd: !this.data.showAdd, showImport: false });
  },
  toggleImport() {
    this.setData({ showImport: !this.data.showImport, showAdd: false });
  },

  onContent(e) {
    this.setData({ newContent: e.detail.value });
  },
  onAnger(e) {
    this.setData({ newAnger: e.detail.value });
  },

  saveAdd() {
    const content = this.data.newContent.trim();
    if (!content) return wx.showToast({ title: '请输入题目', icon: 'none' });
    add(content, this.data.newAnger)
      .then(() => {
        wx.showToast({ title: '已添加', icon: 'success' });
        this.setData({ showAdd: false, newContent: '', newAnger: 5 });
        this.loadMine();
      })
      .catch(() => wx.showToast({ title: '添加失败', icon: 'none' }));
  },

  onPaste(e) {
    this.setData({ pasteText: e.detail.value });
  },

  parseImport() {
    const lines = (this.data.pasteText || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const rows = lines.map((line, i) => {
      let content = line;
      let anger = 5;
      const idx = line.lastIndexOf('|');
      if (idx > 0) {
        const maybe = line.slice(idx + 1).trim();
        const n = Number(maybe);
        if (!isNaN(n) && n >= 0 && n <= 10) {
          anger = Math.round(n);
          content = line.slice(0, idx).trim();
        }
      }
      return { content, anger, key: 'r_' + Date.now() + '_' + i };
    });
    this.setData({ importRows: rows });
  },

  onRowContent(e) {
    const i = e.currentTarget.dataset.index;
    const rows = this.data.importRows.slice();
    rows[i].content = e.detail.value;
    this.setData({ importRows: rows });
  },
  onRowAnger(e) {
    const i = e.currentTarget.dataset.index;
    const rows = this.data.importRows.slice();
    rows[i].anger = e.detail.value;
    this.setData({ importRows: rows });
  },
  removeRow(e) {
    const i = e.currentTarget.dataset.index;
    const rows = this.data.importRows.slice();
    rows.splice(i, 1);
    this.setData({ importRows: rows });
  },

  confirmImport() {
    const rows = this.data.importRows.filter((r) => r.content && r.content.trim());
    if (!rows.length) return wx.showToast({ title: '没有可导入的题目', icon: 'none' });
    batchAdd(rows)
      .then(() => {
        wx.showToast({ title: '已导入 ' + rows.length + ' 道', icon: 'success' });
        this.setData({ showImport: false, pasteText: '', importRows: [] });
        this.loadMine();
      })
      .catch(() => wx.showToast({ title: '导入失败', icon: 'none' }));
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    remove(id)
      .then(() => {
        this.setData({
          list: this.data.list.filter((q) => q.id !== id),
          total: this.data.total - 1,
        });
        wx.showToast({ title: '已删除', icon: 'none' });
      })
      .catch(() => wx.showToast({ title: '删除失败', icon: 'none' }));
  },
});
