// 老虎机组件：父组件递增 trigger 触发滚动；滚动停止后派发 done 事件
const POOL = '真心话大冒险勇气诚实秘密坦白喜欢害怕后悔选择坚持妥协底线自由梦想热爱朋友家人爱人自己陌生人未知真相权利利益尊严信任背叛敢不敢';
const ITEM_H = 80; // 每个符号高度(px)，与 wxss .cell 保持一致

Component({
  properties: {
    trigger: {
      type: Number,
      value: 0,
      observer() {
        this.spin();
      },
    },
  },
  data: {
    reels: [[], [], []],
    positions: [0, 0, 0],
    transitions: ['none', 'none', 'none'],
    spinning: false,
  },
  lifetimes: {
    attached() {
      this.initReels();
    },
  },
  methods: {
    randChar() {
      return POOL[Math.floor(Math.random() * POOL.length)];
    },
    buildReel() {
      const arr = [];
      for (let i = 0; i < 24; i++) arr.push(this.randChar());
      return arr;
    },
    initReels() {
      this.setData({ reels: [this.buildReel(), this.buildReel(), this.buildReel()] });
    },
    spin() {
      if (this.data.spinning) return;
      this.setData({ spinning: true, positions: [0, 0, 0], transitions: ['none', 'none', 'none'] });
      setTimeout(() => {
        const N = this.data.reels[0].length;
        const targets = [0, 1, 2].map((i) => {
          const loops = 8 + i * 2;
          const finalIndex = Math.floor(Math.random() * N);
          return -((loops * N + finalIndex) * ITEM_H);
        });
        const trans = [0, 1, 2].map(
          (i) => `transform ${1.2 + i * 0.4}s cubic-bezier(0.2, 0.8, 0.2, 1)`
        );
        this.setData({ positions: targets, transitions: trans });
        const longest = 1200 + 2 * 400 + 250;
        if (this._t) clearTimeout(this._t);
        this._t = setTimeout(() => {
          this.setData({ spinning: false });
          this.triggerEvent('done');
        }, longest);
      }, 50);
    },
  },
});
