# 真心话抽卡对战小程序

一个微信小程序端的「真心话抽卡对战」游戏。当前交付 **P0 地基 + P1 单人抽卡**，单机可玩；题库管理与西部 2 人实时对战为后续迭代（P2 / P3）。

## 目录结构

```
TrueQA/
├── mp/                      # 微信小程序前端（用微信开发者工具导入此目录）
│   ├── app.js / app.json / app.wxss / config.js
│   ├── components/
│   │   ├── flip-card/       # 翻牌卡（rotateY 正反翻转展示题目）
│   │   └── slot-machine/    # 老虎机（多列滚动 + 减速停止）
│   ├── pages/
│   │   ├── index/           # 抽卡首页（单机抽卡 + 邀请对战入口）
│   │   ├── bank/            # 题库（手动添加 / 列表 / 批量导入）
│   │   └── profile/         # 我的（登录 / 等级 / 经验）
│   ├── services/            # 业务接口封装（user.js / question.js）
│   ├── utils/               # 请求层 + 登录态（request.js / auth.js）
│   └── subpackages/battle/  # 对战分包（room/fight/result 占位，P3 实现）
├── server/                  # Node 后端（零依赖，直接 node 运行）
│   ├── src/index.js         # HTTP 服务（登录 / 抽题 / 增删 / 批量导入 / AI 评分 stub）
│   ├── src/store.js         # JSON 文件持久化
│   ├── src/seed.js          # 10 道系统题种子（普通弹兜底）
│   ├── src/ai.js            # 怒气值 AI 评分占位（后续接大模型）
│   └── data/db.json         # 运行时数据（首次启动自动生成）
└── plan/                    # 需求确认书 / 开发排期
```

## 快速启动

### 1. 启动后端

```bash
cd server
node src/index.js          # 默认监听 http://127.0.0.1:3000
```

零依赖，无需 `npm install`。首次启动会在 `server/data/db.json` 写入系统题种子。
后端同时预留了 WebSocket（`/ws`）路由占位，供 P3 实时对战使用。

### 2. 导入小程序

1. 打开「微信开发者工具」→ 导入项目 → 选择 `mp/` 目录。
2. 填入你自己的 **AppID**（或选「测试号」）。
3. **本地联调关键**：右上角「详情 → 本地设置」勾选 **「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」**。
   否则 `http://127.0.0.1:3000` 会被拦截。
4. 编译运行，点击「抽卡」tab 即可单机抽卡。

### 3. 配置说明

`mp/config.js` 控制后端地址：

```js
ENV: 'dev',
BASE_URL: 'http://127.0.0.1:3000/api',   // 本地后端
WS_URL:  'ws://127.0.0.1:3000',
// 真机 / 提审前改为已备案 HTTPS 域名，并在 MP 后台「开发管理 → 服务器域名」白名单中登记
```

> 注意：微信生产环境强制 HTTPS + 域名白名单。真机调试或提审前，必须把 `BASE_URL/WS_URL`
> 改为 `https://` 域名，并在小程序后台登记 request 合法域名与 socket 合法域名。

## 核心接口（后端）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET  | `/api/health` | 健康检查 |
| POST | `/api/auth/wechat-login` | `code` 换 token（dev 模式可 mock，见 store.js） |
| GET  | `/api/questions/random` | 随机抽取一道（**优先用户题，无则系统题**） |
| GET  | `/api/questions?mine=1` | 列出当前用户自建题 |
| POST | `/api/questions` | 新增一道用户题 |
| PUT  | `/api/questions/:id` | 修改（含怒气值） |
| DEL  | `/api/questions/:id` | 删除 |
| POST | `/api/questions/batch` | 批量导入 `[{content, anger?}]` |
| POST | `/api/ai/score` | 怒气值 AI 评分（当前返回占位 `{anger:5, reason:''}`，后续接大模型） |

所有业务接口需带 `Authorization: Bearer <token>` 头，响应统一信封 `{ code: 0, data, message? }`。

## 已确认的关键决策（详见 plan/需求确认书.md）

- 后端：自建 Node 服务（WebSocket 实时同步，P3 启用）
- 怒气值：首版手动填 + AI 评分接口占位，后续接大模型
- 抽卡：老虎机滚动题目片段 → 翻牌显示完整题；**优先抽用户题**，无则系统题
- 系统题：内置 10 道价值观开放简答作普通弹兜底
- 导航：3 tab（抽卡 / 题库 / 我的），对战从抽卡页按钮进入
- 视觉：全局中性灰白，仅对战页用西部沙漠背景

## 下一步

- **P2 题库管理打磨**：剪贴板批量导入的「逐题确认」交互、怒气值滑块、AI 评分接入。
- **P3 西部对战**：WebSocket 房间、2 人同步、老虎机抽弹、装弹/开枪/受击/阵亡像素动画、
  子弹停滞展开题目、发射方选倍率、血量动画、结算评级 S/A/B/C/D 与经验升级。
