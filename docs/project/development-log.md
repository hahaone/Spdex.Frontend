# Spdex Frontend - 开发记录

## 记录格式

每条记录包含：日期、作者、变更内容、相关说明。

---

## 2026-08-05

### Admin2026 Billing Ledger 回放预检

- `/ai/usage` 的“计费对账”页新增 Billing Ledger 回放预检卡片：
  - 默认执行 dry-run，只统计当前筛选范围内可回放的历史成功调用。
  - 执行按钮仅在 billing ledger 已启用、健康、且 `billable=false` 时可用。
  - 回放结果展示候选记录、尝试写入、新增记录、已存在/跳过记录和账本记录数变化。
- 页面文案明确该能力只用于非计费 shadow ledger 的历史数据补齐与 reconciliation 排查，
  不生成正式账单，也不扣用户真实额度。
- 已通过 Admin `npm run typecheck`、定向 ESLint 和 `npm run build` 验证。
- Frontend commit `3774a80dc7799333c210a62bfb8ee9c6aa9d4354` 已推送并触发
  workflow `31024358489`。
- GitHub Actions build 和 deploy 均成功；本次仅构建并发布 Admin2026，其他前端
  子项目未变更。
- 线上 smoke：
  - `https://admin2026.spdex.com/ai/usage` 返回 200。
  - 响应头
    `x-spdex-web-release=3774a80dc7799333c210a62bfb8ee9c6aa9d4354`，
    确认已命中本次 Admin2026 release。
  - `https://new.spdex.com/ai` 未登录时按预期跳转登录，响应头同样命中该 release。
- 管理台只通过 WebApi Admin 代理访问 replay endpoint；AI ops key 仍仅存在服务端，
  不进入 Admin 浏览器 runtime。

### NewSpdex / Admin MCP 凭证安全提示一致性

- NewSpdex `/account/mcp` 增加凭证安全处理说明：
  - 建议按客户端单独创建 token，便于单独审计和撤销。
  - 发现 token 出现在截图、日志、聊天记录或共享文档中时，先撤销再重建。
  - 提醒外部 Agent 不应读取或输出本地 MCP 配置、请求头、cookie 或完整凭证。
- NewSpdex OAuth 授权页补充第三方客户端边界：
  - 第三方客户端可能保存问题、上下文和工具结果。
  - 第三方平台可能另行收取模型或平台费用。
  - 授权后可在账号中心撤销。
- Admin2026 企业凭据页补充运营安全提示：
  - 签发前确认合同主体、scope、IP 白名单和有效期。
  - 一次性 token 关闭后不可再次查看；如已泄露应立即撤销并重新签发。
  - 正式售卖前仍处于测试计量与账单预演阶段。
- 已通过 NewSpdex/Admin 的 `npm run typecheck`、定向 ESLint 和 `npm run build`
  验证；ESLint 使用 Node 24 运行。
- Frontend commit `7c97fb0d4af7bf93cfb17589de5f656c0a667c3d` 已推送并触发
  workflow `31020257159`。
- GitHub Actions build 和 deploy 均成功；本次仅构建并发布 NewSpdex 与 Admin2026。
- 线上 smoke：
  - `https://new.spdex.com/account/mcp` 未登录时按预期跳转登录。
  - `https://new.spdex.com/account/mcp/authorize` 未登录时按预期跳转登录。
  - `https://admin2026.spdex.com/ai/credentials` 返回 200。
  - 三个路由响应头均为
    `x-spdex-web-release=7c97fb0d4af7bf93cfb17589de5f656c0a667c3d`。

### Admin2026 AI 计费对账与 P5 门禁增强

- `/ai/usage` 的“计费对账”页接入 billing ledger 状态：
  - 展示影子账本启用状态、provider、billing mode、policy version、记录数、最新写入和失败次数。
  - 对 `billable=true`、ledger 未启用、ledger 不健康分别给出管理台级风险提示。
- 新增 Usage 与 Billing Ledger 对账区：
  - 读取 WebApi 管理代理 `/api/admin/ai/billing/reconciliation`。
  - 展示成功调用数、billing ledger 记录数、调用差异和 usage units 差异。
  - 支持导出对账差异 CSV，便于财务和后端共同复核。
- “生产门禁”页新增两个计费检查项：
  - Billing ledger 写入开关和健康状态。
  - Usage 与 billing ledger 可对账。
- 仍保持测试期产品边界：
  - `billable=false`。
  - 不生成正式账单。
  - ledger 未启用时标记为需关注，不误判为正式扣费事故。
  - 正式售卖前仍要求集中账本或等价双写对账、无差异回放和财务签字。
- 已通过 `npm run typecheck`、定向 ESLint 和 `npm run build` 验证。
- Frontend commit `ac8d07afc209cd7c1665101668a4e8b1893a0473` 已推送并触发
  workflow `31019016819`。
- GitHub Actions build 和 deploy 均成功；本次仅构建并发布 Admin2026，其他前端
  子项目未变更。
- 线上 smoke：
  - `https://admin2026.spdex.com/login` 返回 200。
  - `https://admin2026.spdex.com/ai/usage` 返回 200。
  - 响应头 `x-spdex-web-release=ac8d07afc209cd7c1665101668a4e8b1893a0473`，
    确认已命中本次 Admin2026 release。
- 管理台计费页读取的是 WebApi Admin 代理，AI ops key 只存在服务端；前端不会暴露
  ops key。

## 2026-08-03

### NewSpdex AI 分析记录折叠与 P3 联调

- NewSpdex `/ai` 分析记录从单问题长列表改为会话折叠：
  - 默认展示 10 个会话组，更多通过“加载更多”手动展开。
  - 同一比赛或同一上下文短时间连续问题折叠为一组，组内保留单条打开和删除能力。
  - 列表区域固定高度并内部滚动，避免历史记录持续拉长整个页面。
- Admin2026 “AI Agent 自动化”页补齐 P2.10/P2.11：
  - 通知 outbox 查询、provider drill、失败/跳过记录手动 retry。
  - 成本与质量看板增加测试期可调阈值和运营摘要。
  - 页面不展示 raw payload、内部接口地址或 token。
- 已发布测试/灰度环境：
  - NewSpdex/Admin2026 release `d9f5da3`。
  - `new.spdex.com/ai` 页面响应头确认新 release，未登录正常跳转登录。
  - `admin2026.spdex.com/login` 正常加载。
- 页面级联调：
  - 使用 `hahaone` 测试 token 打开 `https://new.spdex.com/ai`，HTTP 200，浏览器控制台无错误。
  - 分析记录 DOM 实测默认 10 组，存在“加载更多 2 组”；会话组示例为“迈阿密国际 vs 哥伦布机员 5 个问题”。
  - 列表区域高度约 560px，内部滚动。
- 后续产品化建议：
  - 由后端返回 `conversationId/sessionId` 和游标分页，替代当前前端启发式分组。
  - 分析记录增加跨设备会话管理、搜索筛选和批量清理。

## 2026-08-01

### SPdex Help Center AI 帮助中心雏形

- 新增独立 Nuxt 应用 `Spdex.Frontend.Help`，作为未来 `help.spdex.com` / `docs.spdex.com` 公开帮助中心的前端雏形。
- 当前先实现 AI 部分：
  - 首页帮助搜索、AI 文档入口、未来板块占位和客服反馈提示。
  - `/ai` AI 帮助专区。
  - `/ai/:slug` 文章页，覆盖 AI 观察助手、SPdex AI MCP、数据口径、watch condition 和安全 FAQ。
- 使用 SPdex 现有 Logo/Favicon 作为视觉资产，并提供 Dockerfile；默认容器端口为 `3006`。
- 暂未接入生产 Ansible/Nginx/GitHub Actions 发布链路，避免在正式 Web 节点上提前引入第六个前端服务导致增量部署风险。
- NewSpdex 用户侧 AI 命名统一为“AI 观察助手”：
  - `/ai` 页面标题、说明和分享标题。
  - 顶部导航、桌面导航、命令面板、登录页 AI 入口。
  - 赛事详情页 AI 快捷入口。

### SPdex AI 命名口径

- 用户侧主名称改为“SPdex AI 观察助手”或“AI 观察助手”。
- 内部 `good_sample` API、类型、storage key 和已有测试链路暂不重命名，避免破坏 AI gateway、golden sample、审计和兼容性测试。

## 2026-07-31

### Admin2026 AI workflow 观察

- `/ai/usage` 增加“Workflow 观察”标签，基于最近 audit 样本聚合 H7A-H7D workflow
  调用状态。
- 展示 workflow 调用数、成功/失败、成功率、用量、平均耗时、P95、最大耗时和最近结果。
- 最近 trace 可直接切换到既有 Trace 查询，便于从 workflow 聚合回到单次调用记录。
- AI 工具筛选列表同步到当前 MCP H1-H7D 工具集，避免 Admin 审计口径停留在早期 6 个工具。
- 已通过 `npm run typecheck` 和本次改动文件定向 ESLint；全量 Admin lint 仍受既有
  analytics/orders/auth 文件规则问题影响。

### Admin2026 AI 站内通知观察

- `/ai/usage` 增加“站内通知”标签，读取 AI in-app adapter 写入的通知记录。
- 页面支持 owner、source、unread 和 limit 过滤，并展示通知数、未读数、主体数和最近写入。
- 表格展示通知标题、正文、级别、owner、condition/trigger 和 compact payload ref；
  raw payload 继续由后端省略。
- 本轮入口定位为内部观察，不替代 NewSpdex 用户侧收件箱和 read/mark-read 生命周期。

### NewSpdex AI 收件箱调试入口

- `/push` 增加 AI 收件箱调试面板，读取当前用户自己的 AI watch condition in-app
  通知。
- 支持只看未读、刷新、单条标为已读和全部标为已读；列表展示标题、正文、级别、
  观察对象和命中类型。
- 新增 `NUXT_PUBLIC_AI_NOTIFICATIONS_VISIBLE`，默认 false；后端还要求
  `NewSpdex:AiAccess:DebugFeaturesEnabled=true` 和测试账号 allowlist，避免正式用户发布。
- 本轮不做全局红点、正式消息中心、通知偏好或生产投递演练。

### NewSpdex AI 通知后续计划记录

- 当前 `/push` AI 收件箱只作为 H8 前置调试入口，不进入正式用户发布范围。
- 下一阶段先设计正式通知中心 IA、未读红点/count、用户通知偏好和 condition 级订阅口径。
- provider 生产门禁和端到端投递演练完成前，email/webhook 不向正式用户开放；in-app
  仍需 debug gate、测试 allowlist 和 `NUXT_PUBLIC_AI_NOTIFICATIONS_VISIBLE=true`。
- AI 观察助手或个人 MCP 入口未来 public 后，也不能自动带出 AI 收件箱，二者 release
  switch 独立。

## 2026-07-30

### 文档信息架构整理

- 新增 `docs/README.md`，按多个前端子项目提供统一导航，并链接后端文档正源。
- 通用项目文档迁入 `docs/project/`，Admin2026 方案迁入 `docs/admin/`，
  Web 节点手册迁入 `docs/operations/`。
- NewSpdex 的旧站分析、设计参考和本地设计源稿统一迁入
  `docs/products/newspdex/`；本地源稿继续由 `.gitignore` 排除。
- 品牌图片迁入 `docs/assets/brand/`，不修改各前端运行时 public 资源。
- 本次只整理文档和文档素材，不修改前端业务代码、构建配置、CI/CD 触发语义
  或线上发布状态。

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

### Quantilearn 模型广场订阅闭环 MVP

- `useQuantilearnApi` 新增订阅接口封装：
  - `getMySubscriptions`
  - `subscribeModel`
  - `renewSubscription`
  - `cancelSubscription`
- 模型广场接入真实订阅动作：
  - 未订阅模型展示“订阅”。
  - 已订阅模型展示到期日，并提供“续订”和“取消”。
  - 自己的模型展示“我的模型”，禁止订阅。
- 广场列表读取后端 `subscriptionExpiresAtUtc` 并格式化为用户可读日期。
- 操作完成后自动刷新模型广场，失败时展示用户友好的接口错误。
- 已通过 `npm run typecheck`、新版 Node 环境下的 `npm run lint`、`npm run build` 验证。

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
- 创建 `docs/` 文档目录。当前正源已整理到：
  - `docs/project/requirements.md` - 需求文档
  - `docs/project/architecture.md` - 架构设计
  - `docs/project/development-guide.md` - 开发与部署指南
  - `docs/project/development-log.md` - 开发记录（本文件）

---

> 请在每次重要变更后追加记录。
