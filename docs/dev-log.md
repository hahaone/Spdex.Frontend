# Spdex Frontend - 开发记录

## 记录格式

每条记录包含：日期、作者、变更内容、相关说明。

---

## 2026-06-03

### Quantilearn 我的模型范围修正

- “我的模型”工作区收口为当前登录账号创建的模型，不再把模型创建者 `UserId` 显示成 `User xxxx`。
- 模型顶部归属文案改为“我的模型 / 可见模型”，避免把旧 Mongo 的内部 `UserId` 误解为当前登录用户。
- 左侧模型筛选改为“全部、未发布、已发布、锁定”，移除不属于当前账号模型管理主流程的“订阅、临时”筛选入口。
- 中间操作矩阵跟随左侧筛选结果，空状态明确提示“当前账号没有符合筛选条件的模型”。
- 登录态本地测试时默认走 Nuxt BFF，由 BFF 附加 Quantilearn 可信 Header；无登录原型调试仍可直连本地 API。
- 已通过 `npm run typecheck`、新版 Node 环境下的 `npm run lint`、`npm run build` 验证。

### Quantilearn 品牌 Logo 更新

- 将用户提供的 `spdex_logo_s.png` 复制到 Quantilearn Web 子项目 public 资源目录，作为新量化 Web 端独立打包资源。
- 工作台顶栏和 `/flash` 闪Q单场分析页统一使用 SPdex 横向 logo。
- 工作台标题调整为“Quantilearn”，避免与 logo 中的 SPdex 字样重复。
- 已通过 `npm run typecheck`、新版 Node 环境下的 `npm run lint`、`npm run build` 验证。
- 浏览器验证 `http://127.0.0.1:3005/` 和 `/flash?eid=35675743` 均正确加载 logo，顶栏渲染尺寸为 96x32。

### Frontend 选择性构建与部署

- 优化 `.github/workflows/deploy.yml`，新增 `changes` job 通过 `git diff` 检测本次提交影响的前端子项目。
- Push 触发时按路径选择构建和部署：
  - `Spdex.Frontend.Fjc/**` -> `frontend`
  - `Spdex.Frontend.2026/**` -> `frontend2026`
  - `Spdex.Frontend.NewSpdex/**` -> `frontend-newspdex`
  - `Spdex.Frontend.Quantilearn/**` -> `frontend-quantilearn`
- `.github/workflows/deploy.yml` 自身变更按全量构建处理，用于验证新流水线。
- 手动触发 `workflow_dispatch` 保留原来的全量构建语义。
- Deploy 阶段按变更结果只 `docker compose pull/up` 对应服务，未变更的服务不再重启。
- 已通过本地 YAML 解析校验，并用脚本模拟验证 Quantilearn、NewSpdex、docs、workflow 四类路径的选择结果。

### Quantilearn SSR 登录态与诊断入口收口

- 修复 Quantilearn 工作台 SSR 数据加载时没有向前端 BFF 转发 `newspdex_token` Cookie 的问题：
  - `useQuantilearnApi` 在服务端请求 `/api/quantilearn/**` 时转发原始 `cookie` 和 `authorization` 请求头。
  - 避免已登录用户进入 `ql.spdex.com` 后，模型、因子、权限等 SSR 首屏请求被 BFF 误判为未登录并返回 401。
- 移除用户侧“数据诊断”工作区：
  - 顶部导航不再展示“数据诊断”。
  - 首页不再请求 `/api/quantilearn/diagnostics/mongo`。
  - 页面不再展示 API 地址、接口清单、Mongo 集合名和内部缓存键。
- 用户可见错误文案统一脱敏，模型、因子、闪Q等页面不再把 `$fetch` 的原始 `/api/quantilearn/**` 路径展示给终端用户。
- Quantilearn 前端 BFF 对 `/api/quantilearn/diagnostics/*` 返回 404，保留私网后端诊断接口给部署脚本和运维使用，不通过 `ql.spdex.com` 对终端用户暴露。
- 已通过 `npm run typecheck`、新版 Node 环境下的 `npm run lint`、`npm run build` 验证。
- 本地浏览器验证 `http://127.0.0.1:3005/`：
  - 顶部工作区仅保留“我的模型、建模器、回测报告、模型赛事、模型广场”。
  - 可见文本不包含“数据诊断”、`/api/quantilearn`、Mongo 集合名或内部缓存键。
  - `GET /api/quantilearn/diagnostics/mongo` 经前端 BFF 返回 HTTP 404。

### Quantilearn ql.spdex.com 公开域名配置

- Quantilearn Web 新公开域名调整为 `https://ql.spdex.com`。
- `nuxt.config.ts` 新增 `NUXT_PUBLIC_QUANTILEARN_PUBLIC_BASE_URL`，生产默认值为 `https://ql.spdex.com`。
- 全局认证 middleware 的服务端回跳地址不再硬编码 `q.spdex.com`，改为使用 `NUXT_PUBLIC_QUANTILEARN_PUBLIC_BASE_URL`。
- `.env.example` 增加新变量示例，便于生产部署和本地复核。

### Quantilearn 闪Q单场分析页

- 新增 `Spdex.Frontend.Quantilearn/app/pages/flash.vue`，实现 `/flash?eid={eventId}` 单场分析工作台。
- 接入 Quantilearn API 的 `GET /api/quantilearn/flash/events/{eventId}` 单场快照接口，支持即时、1h、2h、3h、6h 快照切换。
- 页面按旧版 `FlashQ.aspx` 的业务结构重组为赛事摘要、因子分组矩阵、多因子参数面板和数据状态面板，减少无效留白，优先适配分析人员高密度浏览与快速筛选。
- 在 `useQuantilearnApi` 中补充 FlashQ 快照数据类型和 `getFlashEventSnapshot` 方法，保持前端 API 调用集中封装。
- 本阶段的“分析”按钮保留为参数确认入口，等待后续新增基于多因子参数的回测/匹配接口后接入真实结果。
- 已通过 `npm run typecheck`、新版 Node 环境下的 `npm run lint`、`npm run build` 验证。

### Quantilearn 闪Q分析结果接入

- `useQuantilearnApi` 新增 `analyzeFlashEvent`，接入 `POST /api/quantilearn/flash/events/{eventId}/analysis`。
- `/flash` 页面把已选因子的 Min/Max 和逻辑比较转换为临时模型请求，支持全部、联赛、杯赛、友谊赛口径。
- 分析结果区新增 7日、30日、1年与全场/半场切换，展示总匹配、周期样本、有效赛果、最佳方向、市场分布和进球分布。
- 已通过 `npm run typecheck`、新版 Node 环境下的 `npm run lint`、`npm run build` 验证。

### Quantilearn 因子展示与移动端体验修正

- 所有因子相关页面不再向用户展示底层字段名：
  - `/flash` 因子矩阵移除“字段”列，不再显示 `BfIndexHome`、`BfAmount...` 等内部字段。
  - `/flash` 已选参数卡片仅展示中文名称、当前值和区间，不再展示内部因子编号。
  - 主工作台“因子建模器”移除字段列，仅展示因子、默认范围和权限。
- `/flash` 移动端因子列表改为紧凑卡片式行：
  - 每行展示中文因子名、当前值、建议区间和范围。
  - 分组入口改为横向可扫的紧凑标签，避免窄屏横滑后只看到技术字段。
  - 回测市场表在窄屏隐藏次要列，优先保留市场、方向、数量、占比和均赔。
- 已通过 `npm run typecheck`、新版 Node 环境下的 `npm run lint` 验证。
- 浏览器验证 `/flash?eid=35675743` 在约 508px 视口下无“字段”标签和 `Bf...` 字段名，主工作台建模器同样无字段展示。

### Quantilearn 因子分组布局优化

- `/flash` 因子分组选项卡在移动端改为紧凑网格：
  - 5 个大类完整铺开，不再依赖横向滚动。
  - 窄屏使用短标题：标准盘、市场、进球、标盘内外、进球内外。
  - 430px 以下自动降为 2 列，保证每个分组按钮可读可点。
- 主工作台“因子建模器”把因子分组从左侧竖排改为顶部多列分组条：
  - 因子目录获得完整横向空间。
  - 9 个分组按容器宽度自动排布，移动端保持 3 列/2 列响应式。
  - 分组按钮展示名称、因子范围和当前状态，便于快速定位。
- 已通过 `npm run typecheck`、新版 Node 环境下的 `npm run lint`、`npm run build` 验证。
- 浏览器验证 `/flash?eid=35675743` 和主工作台建模器，分组入口均可见、可点击，且无底层字段名展示。

### Quantilearn FlashQ 匹配赛事明细

- `useQuantilearnApi` 新增 `getFlashEventMatches`，接入 `POST /api/quantilearn/flash/events/{eventId}/matches`。
- `/flash` 页面在临时模型回测完成后自动读取最近匹配赛事：
  - 跟随当前 `7日 / 30日 / 1年` 时间窗。
  - 跟随当前 `全场 / 半场` 口径。
  - 复用当前已选因子区间和逻辑比较。
- 报告区新增“最近匹配赛事”：
  - 桌面展示时间、赛事、比分、胜平负、让球、进球和赔率。
  - 移动端折叠为赛事卡片，优先展示队名、比分、时间和三个市场方向。
- 移动端新增底部固定分析条，用户选好因子后无需滚动到参数面板即可发起分析。
- 已通过 `npm run typecheck`、新版 Node 环境下的 `npm run lint`、`npm run build` 验证。
- 已通过本地前端连接远端 Quantilearn API 验证 `/flash?eid=35675743`：
  - `POST /api/quantilearn/flash/events/{eventId}/matches` 返回 24 条最近匹配赛事。
  - 390px 移动端视口无横向溢出，底部分析条可触发回测。
  - 页面可见文本无“字段”、`Bf...` 字段名和 `fxx` 内部因子编号。

## 2026-02-09

### 项目初始化

- 初始化 Spdex.Frontend 仓库
- 创建 Spdex.Frontend.Fjc 子项目（Nuxt 3 + Vue 3 + TypeScript）
- 配置 API 代理，连接 Spdex.WebApi 后端（`localhost:5000`）
- 搭建基础页面结构：首页、默认布局
- 封装 `useApiFetch` 和 `useApiHealth` 组合式函数
- 配置 ESLint 代码规范和 TypeScript 严格模式

### 添加项目文档和 .gitignore

- 在仓库根目录添加 `.gitignore`，覆盖 Node.js、Nuxt、IDE、OS 等忽略规则
- 创建 `docs/` 文档目录：
  - `requirements.md` - 需求文档
  - `design.md` - 设计文档
  - `implementation.md` - 实施方案
  - `dev-log.md` - 开发记录（本文件）

---

> 请在每次重要变更后追加记录。
