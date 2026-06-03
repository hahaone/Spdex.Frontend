# Spdex Frontend - 开发记录

## 记录格式

每条记录包含：日期、作者、变更内容、相关说明。

---

## 2026-06-03

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
