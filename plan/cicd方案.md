# 微信小程序 CI/CD 方案

## 一、先厘清：小程序没有传统"部署"
普通 Web 项目 CI 是 build → 推到服务器。小程序不一样：
- 代码**不能自己跑在服务器上**，它跑在微信客户端里。
- 所谓"部署"= 把代码**上传**到微信（成为开发版/体验版），再人工在后台**提交审核 → 发布**。
- 上传必须用微信官方工具 **`miniprogram-ci`**（DevTools 的命令行等价物），且需要一把**上传密钥**。

所以小程序 CI 的能力边界是：
| 阶段 | 能否自动化 | 说明 |
| --- | --- | --- |
| 预览二维码（真机测试） | ✅ 可自动化 | `miniprogram-ci preview` 生成二维码，扫一扫即真机预览 |
| 上传为体验版 | ✅ 可自动化 | `miniprogram-ci upload` |
| 提交审核 | ⚠️ 基本手动 | 微信审核需人工在 MP 后台点；OpenAPI 可触发但有风控，不推荐全自动 |
| 发布 | ⚠️ 人工 | 审核通过后人工发布 |

## 二、本仓库已备好的文件
- `scripts/ci-miniprogram.js`：基于 `miniprogram-ci`，支持 `preview`（出二维码）/ `upload`（传体验版）。
- `.github/workflows/wechat-miniprogram.yml`：GitHub Actions。
  - `push` 到 `main` → 自动生成**预览二维码**并作为 Artifact 产出（最常用于"测试界面效果"）。
  - 手动 `workflow_dispatch` 选 `upload` → 上传为体验版。
- `.gitignore`：排除密钥、node_modules、运行时数据。

> CI 脚本用 `ignores` 把 `web/ server/ plan/ .github/ scripts/` 排除在上传包之外，只传 `mp/` 本身，避免包体虚胖。

## 三、你需要补的两样东西（我拿不到）
1. **真实 AppID**：在微信公众平台「开发管理 → 开发设置」查看。
   - 注意：`mp/project.config.json` 里现在是 `touristappid` 占位。CI 里脚本用环境变量 `WX_APPID` 覆盖，不影响上传；但你在**开发者工具里打开**仍需把它改成真实 AppID。
2. **代码上传密钥**：公众平台「开发管理 → 开发设置 → 小程序代码上传密钥 → 生成并下载」得到 `private.key`（pem 文本）。
   - 生成时可勾选 **「不限制 IP」**，否则要额外把 GitHub Actions 的出口 IP 加白名单（出口 IP 不固定，不限制最省事）。

## 四、接入 GitHub Actions 的步骤
1. 本地 `git init`，提交当前代码（含 `.github/` 与 `scripts/`）。
2. 在 GitHub 新建仓库，把代码 push 到 `main`。
3. 仓库 `Settings → Secrets and variables → Actions` 增加两个 Secret：
   - `WX_APPID` = 你的真实 AppID
   - `WX_PRIVATE_KEY` = `private.key` 文件的**完整文本内容**
4. 触发：
   - 直接 `git push` 到 main → 自动产出预览二维码（Actions → Artifacts 下载 `preview-qr`，扫码真机预览）。
   - 或 `Actions → 选 WeChat Mini Program CI → Run workflow → mode=upload` → 上传体验版。
5. 体验版通过后，在 MP 后台「版本管理」手动提交审核、发布。

## 五、测试界面效果的几条路（由快到真）
1. **网页预览版（现在就能用）**：本地已起 `http://127.0.0.1:8080`，复刻了抽卡+翻牌+题库，浏览器里直接点。逻辑/动画最快验证。
2. **开发者工具模拟器**：导入 `mp/`、勾选「不校验合法域名」、编译，看的是**真实小程序组件**（slot-machine / flip-card 组件），最贴近真机结构。
3. **真机预览（CI 出码）**：上面的 GitHub Actions `preview` 产出二维码，微信扫一扫在真机上跑——保真度最高，也是你问的"CICD 流"最大价值点。

> 注意：本地 `urlCheck:false` 和不校验域名只在**开发期**有效。真机/体验版要让后端可达，必须把 `mp/config.js` 的 `BASE_URL` 改成**已备案 HTTPS 域名**，并在 MP 后台「服务器域名」登记 request 合法域名 + socket 合法域名。当前后端是 `http://127.0.0.1:3000`，真机访问不到，需换成你的服务器地址。

## 六、关于"回答端界面"
当前 P1 只做了单人抽卡（抽题+翻牌）。**受击方作答界面属于 P3 西部对战，尚未开发**。因此现在能测的界面只有抽卡/翻牌；若想要"回答端"可测，需要先做 P3。见对话末尾选项。

## 七、其他可选
- CI 服务器若需固定出口 IP（不勾选"不限制 IP"时），可用 GitHub 自托管 Runner 或固定 NAT 的 Runner。
- 多环境：用 `WX_APPID` / `WX_PRIVATE_KEY` 区分测试号与生产号，分两个 Secret 或在 `workflow_dispatch` 里加 env 选择。
- 国内账号 + 海外 GitHub Actions 偶尔连微信 API 慢，必要时可换微信官方"小程序 CI"（云效/CODING）或自托管 Runner。
