# Spdex.Frontend.Admin 管理后台 — 需求分析 · 技术方案 · 开发计划

> **文档状态**：v0.2 草案（已吸收评审 6 项修正），待评审
> **创建日期**：2026-06-04 ｜ **修订**：2026-06-05
> **适用范围**：NewSpdex 产品线运营/客服/财务后台（不含 Quantilearn 工作台、不含 C 端功能）
> **关联代码**：`Spdex.Frontend/Spdex.Frontend.Admin/`（待建）、`Spdex.Core/Spdex.WebApi`（新增 `/api/admin/*`）

## 已定关键决策（评审前锁定）

| # | 决策项 | 结论 | 理由摘要 |
|---|---|---|---|
| D1 | 前端 UI 技术栈 | **Nuxt 4 + Naive UI** + Tailwind（布局） | 沿用现有前端构建/部署范式；Naive UI 提供中后台表格/表单/弹窗/树形组件，TS 友好、体积小、有 Nuxt 模块 |
| D2 | 鉴权与权限模型 | **独立 Admin 账号体系 + RBAC** | 与 C 端 `Users` 完全隔离，安全边界清晰；支持超管/运营/客服/财务/审计角色；每个写操作审计到人 |
| D3 | 网络访问边界 | **公网 `admin.spdex.com` + 强鉴权 + IP 白名单** | 运营/客服可异地办公；nginx 出口 IP 白名单 + JWT + 登录限流构成安全基线，后续可加 2FA |

## 评审修正（v0.2，已吸收）

> 2026-06-05 评审意见 6 项，全部采纳。以下为修正后口径；与下文正文冲突处，**以本节为准**。

**1. P0 范围拆分（修正第三部分计划）** — 原 P0 过大，拆为：
- **P0a（先上线）**：Admin 登录/RBAC/审计 + 用户查询/改会籍 + 锦囊查询/小额调账 + 部署上线。
- **P0b**：订单查询 + 退款工单 + 只读对账。
- **P1**：套餐去配置化、信号规则热加载（M5/M6）。
→ **第一版只交付「用户会籍 + 锦囊账本 + 审计日志」**，最快消灭手工 SQL，且不触碰支付/信号核心链路。（§3.2 的 WBS 即 P0a 范围；其中 M3 订单移至 P0b。）

**2. ComputeNewEndDate 需先重构（阻塞 P0a，修正 M2/§2.3）** — 现 `NewSpdexBillingService.ComputeNewEndDate` 是 `private static`（line 262），后台无法直接复用。P0a 首个动手项：抽成共享 **`MembershipEndDateCalculator`**（公开 domain service，覆盖新购/续费/升级折算），补单元测试，**支付链路与后台改会籍共用同一实现**；升级折算边缘 case 同步与旧系统抽样对账。

**3. 财务接口禁止脏读（修正 §1.6）** — `WITH(NOLOCK)` 仅限运营展示类列表。**订单、退款、锦囊余额、对账等碰钱的一致性接口必须强一致读（不加 NOLOCK）**，至少 READ COMMITTED。

**4. AdminJwt 迁移 = 统一身份抽象（修正 §2.3.1/§2.3.5）** — 不是「仅加一个 scheme」。现有 admin 端点用 ApiKey claim `api_key_name` 作操作人（如 `SilkBagUpdateLog.OperUserId`）。迁移须引入统一 **`AdminPrincipal`**（adminId/adminName/role/perms），并把 OperUserId、操作日志、审计**全部改写为真实 adminId/adminName**；ApiKey 与 AdminJwt 双轨过渡期内两种身份都归一到 AdminPrincipal。

**5. 审计 before/after 需业务层快照（修正 §2.3.3）** — ActionFilter 只能记 who/when/request；改前/改后值须业务服务主动提供。P0a 即定下 **`AdminAuditScope` / `AuditedCommand` 模式**（服务层捕获 before → 执行 → 捕获 after → 统一落库），**不做成「可选」**。

**6. 部署贴合现有 CI/CD（修正 §2.6）** — 现网由 GitHub Actions 构建镜像推 Aliyun ACR，服务器 compose 仅 `pull`/`up`，**不在服务器 `build`**。Admin 前端接入 `Spdex.Frontend/.github/workflows/deploy.yml` 的 detect/build/deploy（加 `Spdex.Frontend.Admin/*` 路径 + `IMAGE_ADMIN`）；`Spdex.Core/docker-compose.yml` 增 `frontend-admin` 服务用 `image:`（非 `build:`）。

---

# 第一部分 · 需求分析

## 1.1 背景与问题陈述

NewSpdex 后端的运营能力处于「**造了引擎没装方向盘**」的状态：

- 后端已有 3 个 admin controller（`AdminController` 令牌、`SilkBagAdminController` 锦囊、`AdminTeaching2026Controller` 选赛），但**前端从未实现**——只有 `Spdex.Frontend.2026/app/pages/admin/` 一个空目录。
- 数据库 `SilkBagUpdateLog.OperUserId` 字段早已预留管理员痕迹位，**印证后台是规划过但未落地**。
- 大量运营动作目前靠工程师**直连生产库 SQL** 或**改 `appsettings.json` + 重启**完成。

### 现状痛点（按风险排序）

| 运营动作 | 当前载体 | 风险 | 本应由谁操作 |
|---|---|---|---|
| 退款 / 补单 / 对账 | ❌ 无代码，纯手工 SQL | 🔴 碰钱、易错、无审计 | 客服 / 财务 |
| 改会员 tier / 到期日 | 手工 `UPDATE Users` | 🔴 直改生产库 | 客服 |
| 查用户 + 锦囊余额 + 调账 | 后端 API 已就绪，但无 UI、需先 SQL 查 userId | 🟡 能力有界面无 | 客服 |
| 会员定价（25+ 价格常数） | `appsettings.json` + **重启** | 🟡 改价要发版 | 运营 |
| 信号规则（7 条 JSON） | `appsettings.json` + **重启** | 🟡 无法热更、无法灰度 | 策略 / 产品 |
| 锦囊分成 / 充值奖励配置 | 手工改 `SilkBag_SysConfig` 表 | 🟡 | 运营 |
| Banner / 公告 / 用户工单 | ❌ 完全缺失 | 🟢 | 运营 / 客服 |

## 1.2 目标（Goals）

1. **让非技术人员自助**：运营/客服/财务无需工程师介入即可完成日常操作。
2. **消灭直连生产库**：所有数据变更通过受控、可审计的后台接口。
3. **操作可审计到人**：谁、在何时、改了什么、改前改后值，全部留痕不可删。
4. **业务参数热生效**：会员定价、信号规则等从配置文件迁入数据库，后台改完即时生效，免重启。
5. **最小权限**：按角色精确授权，客服碰不到信号规则，运营碰不到大额调账。

## 1.3 范围（Scope）

### In Scope（分期见第三部分）
- 管理员账号 / 角色 / 权限 / 操作审计（系统基建）
- 用户与会员管理、订单与对账、锦囊账本
- 会员套餐与定价、信号引擎规则配置（含「去配置化」）
- 内容运营（教学选赛、News、Banner、公告、客服配置）、推送管理

### Out of Scope（明确不做）
- C 端用户功能（属 NewSpdex 前端）
- Quantilearn 量化工作台后台（独立产品，另行规划）
- BI / 数据可视化大盘（二期之后按需）
- 旧 `weixin.spdex.com` 运营后台的逐项复刻（已确认会员/支付主链路本地化，本后台为本地能力的 UI）

## 1.4 用户角色与权限模型（RBAC）

### 角色定义

| 角色码 | 角色 | 职责 |
|---|---|---|
| `super` | 超级管理员 | 全部权限，含管理员账号/角色管理、系统配置 |
| `ops` | 运营 | 内容、套餐定价、信号规则、推送、锦囊运营配置 |
| `support` | 客服 | 用户查询、改到期/重置密码、订单查询、发起退款工单、小额锦囊调账 |
| `finance` | 财务 | 订单/对账、退款审批、锦囊调账、充值奖励配置 |
| `auditor` | 审计（只读） | 全模块只读 + 审计日志查看 |

### 权限点（Permission Keys）

```
system.admin.manage   system.role.manage   system.audit.view
user.view   user.membership.edit   user.status.edit   user.password.reset
order.view   order.refund.request   order.refund.approve   order.reconcile
silk.view   silk.adjust.small(≤阈值)   silk.adjust.large   silk.config
plan.view   plan.edit
signal.view   signal.config
content.teaching   content.news   content.banner   content.announcement   content.cs
push.send   push.template
```

### 权限矩阵（角色 × 权限）

| 权限点 | super | ops | support | finance | auditor |
|---|:--:|:--:|:--:|:--:|:--:|
| system.admin.manage | ✅ | — | — | — | — |
| system.role.manage | ✅ | — | — | — | — |
| system.audit.view | ✅ | — | — | ✅ | ✅ |
| user.view | ✅ | ✅ | ✅ | ✅ | 👁 |
| user.membership.edit | ✅ | — | ✅ | ✅ | — |
| user.status.edit | ✅ | — | ✅ | — | — |
| user.password.reset | ✅ | — | ✅ | — | — |
| order.view | ✅ | — | ✅ | ✅ | 👁 |
| order.refund.request | ✅ | — | ✅ | ✅ | — |
| order.refund.approve | ✅ | — | — | ✅ | — |
| order.reconcile | ✅ | — | — | ✅ | 👁 |
| silk.view | ✅ | ✅ | ✅ | ✅ | 👁 |
| silk.adjust.small | ✅ | — | ✅ | ✅ | — |
| silk.adjust.large | ✅ | — | — | ✅ | — |
| silk.config | ✅ | ✅ | — | ✅ | — |
| plan.edit | ✅ | ✅ | — | — | — |
| signal.config | ✅ | ✅ | — | — | — |
| content.* | ✅ | ✅ | — | — | — |
| push.send | ✅ | ✅ | — | — | — |

> 👁 = 只读视图；✅ = 可写/可执行；— = 无权限。`silk.adjust.small` 阈值（如 ≤100 锦囊）由 `system` 配置。

## 1.5 功能需求（按模块）

> 每模块标注：优先级、关键用例、**复用**或**新增**后端端点、关键实体（字段详见附录 C）。

### M1 · 工作台 Dashboard（P1）
- 关键指标卡：今日新增/付费用户、今日订单额、待处理退款工单、锦囊净流水、活跃信号数。
- **新增** `GET /api/admin/dashboard/overview`（可复用 `PolymarketWarmingService` 式缓存）。

### M2 · 用户与会员管理（P0）⭐
- 用例：按用户名/手机号/邮箱/UserId 搜索 → 查看资料与会籍 → 改 RoleId+EndDate（开通/续费/降级）→ 封禁/解封 → 重置密码。
- 关键实体：`Users`（UserId/UserName/RoleId/EndDate/UserState/MobileNum/Email/RegisterDate/LastActivityDate）。
- 会籍变更**必须复用** `NewSpdexBillingService.ComputeNewEndDate`（与支付链路同一算法），不可前端自行计算。
- **新增** `GET /api/admin/users`、`GET /api/admin/users/{id}`、`PUT /api/admin/users/{id}/membership`、`PUT /api/admin/users/{id}/status`、`POST /api/admin/users/{id}/reset-password`。

### M3 · 订单与对账（P0）⭐
- 用例：订单查询（按用户/渠道/状态/时间）→ 查看详情与回调原文 → 发起退款工单 → 财务审批 → 对账视图（本地订单 vs 渠道流水）。
- 关键实体：`NewSpdexPaymentOrder`（Status：0 待支付/1 已支付/2 失败关闭；Channel：alipay/wxcode；ProductType：0 会员/1 锦囊；TradeNo/NotifyRaw/PaidTime）。
- ⚠️ 当前**无退款字段与逻辑**：需新增退款工单表 + 状态机；首期对账先做**只读比对**，退款走人工审批 + 记录。
- **新增** `GET /api/admin/orders`、`GET /api/admin/orders/{id}`、`POST /api/admin/orders/{id}/refund`、`GET /api/admin/orders/reconcile`。

### M4 · 锦囊账本（P0，后端基本就绪）⭐
- 用例：按 UserId/手机号查三账户余额（充值/奖励/分成）→ 调账（含理由必填）→ 查消费/奖励/分成/调账流水 → 维护系统配置与充值奖励配置。
- 关键实体：`SilkBagBalance`、`SilkBagLog`、`SilkBagRewardLog`、`SilkBagShareLog`、`SilkBagUpdateLog`、`SilkBag_SysConfig`、`SilkBag_PayRewardConfig`。
- **直接复用** `SilkBagAdminController` 全部端点（详见附录 A），仅需把鉴权从 ApiKey 迁到 AdminJwt + policy。

### M5 · 会员套餐与定价（P1，需「去配置化」）
- 用例：管理 5 档会员 × 各时长价格档、HOT 标记、显示顺序、折扣文案。
- 现状：硬编码于 `appsettings.json` `SpdexBilling.MembershipPlans` + `NewSpdexMembershipCatalog.DefaultPlans` 兜底。
- 方案：迁入 `Membership_Plan` + `Membership_Price_Stage` 表，`NewSpdexMembershipCatalog` 改为从 repo + `ISpdexCache` 读取，后台改完失效缓存即时生效。
- **新增** `GET/POST/PUT/DELETE /api/admin/plans`、`.../plans/{id}/stages`。

### M6 · 信号引擎配置（P1，需「去配置化」）
- 用例：信号模型启用/停用、阈值/条件调整、查看触发历史（`SignalRecord` 全生命周期）。
- 现状：规则在 `appsettings.json` `SignalEngine.Models`，改动需重启；`SignalMonitorService` 启动时读取。
- 方案：迁入 `Signal_Rule` 表（条件以 JSON 存 `NVARCHAR(MAX)`），`SignalMonitorService` 改为周期性从 DB 热加载。
- **新增** `GET/POST/PUT /api/admin/signal-rules`、`PUT .../{id}/enabled`、`GET /api/admin/signals`（记录查询）。

### M7 · 内容运营（P1/P2）
- 教学选赛（P1）：**复用** `AdminTeaching2026Controller`（候选/已开放/PUT 开放），扩展到 NewSpdex 频道。
- News（P1）：`News` 实体已存在，补 CRUD UI。
- Banner / 公告（P2）：**实体缺失**，新增 `Content_Banner`、`Content_Announcement`。
- 客服配置（P2）：现 `appsettings.json` `SpdexBilling.CustomerService`，迁 DB 或保留配置 + 后台只读。

### M8 · 推送管理（P2）
- 用例：群发 Web Push、推送模板、发送记录。复用现有 `NewSpdexPushService` + VAPID 基建。
- **新增** `POST /api/admin/push/broadcast`、推送模板 CRUD。

### M9 · 系统与安全（P0，基建）⭐
- 管理员账号 CRUD、角色分配、改密、启用/禁用。
- 操作审计日志查询（全写操作留痕）、登录日志查询。
- **新增** `/api/admin/auth/*`、`/api/admin/admins/*`、`/api/admin/roles`、`/api/admin/audit-logs`、`/api/admin/login-logs`。

## 1.6 非功能需求

| 类别 | 要求 |
|---|---|
| **认证** | 独立 AdminJwt；密码强哈希（PBKDF2/BCrypt）；登录失败锁定（复用 `LoginThrottleService` 思路）；可选 TOTP 2FA（二期） |
| **授权** | 后端强制 RBAC policy，**不信任前端**；越权一律 403 |
| **审计** | 所有 POST/PUT/DELETE 自动留痕（who/what/before/after/ip/ua），日志只增不可删 |
| **敏感操作** | 二次确认弹窗 + 影响范围提示；调账/退款理由必填；大额操作高亮 |
| **网络** | HTTPS；`admin.spdex.com` 独立证书；nginx IP 白名单；限流 |
| **性能** | 列表强制分页（默认 50/页）；大表查询走 `WITH(NOLOCK)` 参数化 SQL（沿用现有 repo 范式） |
| **数据脱敏** | 列表页手机号/邮箱脱敏，详情按权限展示 |
| **一致性** | 复用 `ApiResponse<T>`、`ISessionProvider`、`ISpdexCache`、NHibernate 模式 |

---

# 第二部分 · 技术方案

## 2.1 总体架构

```
浏览器 (admin.spdex.com)
   │  HTTPS + httpOnly Cookie(AdminJwt)
   ▼
nginx  ── IP 白名单 allow/deny ── proxy_pass 127.0.0.1:3005
   ▼
Spdex.Frontend.Admin  (Nuxt 4 SSR, Naive UI)
   │  server/api BFF：从 httpOnly cookie 取 token → 注入 Bearer 转发
   ▼
Spdex.WebApi   /api/admin/*   [Authorize(AdminJwt + Policy)]
   ├─ AdminAuthService / RBAC / 审计 ActionFilter
   ├─ 复用：SilkBagAdminController / AdminTeaching2026Controller / AdminController
   ├─ 新增：Users/Orders/Plans/SignalRules/Content/Push/Admins 控制器
   ▼
Spdex.DataMap (NHibernate) ──► SQL Server (BetFairOdds)
                              新增表：Admin_User / Admin_Audit_Log / Admin_Login_Log
                                      Membership_Plan / Signal_Rule / Content_* …
```

后端**不新增容器**（同 `webapi`，仅增 controller + 配置段）；前端新增 1 个容器 `frontend-admin`。

## 2.2 前端技术方案

- **栈**：Nuxt 4.3.1 + Vue 3.5 + TS（strict）+ Naive UI + Tailwind（仅布局）+ `@nuxt/eslint`。
- **端口**：`3005`（现有：Fjc 3000 / 2026 3001 / NewSpdex 3002 / Quantilearn 3004）。
- **目录结构**（参照 `Spdex.Frontend.Quantilearn`）：

```
Spdex.Frontend.Admin/
├─ nuxt.config.ts          # 复制 Quantilearn 模板，改 runtimeConfig
├─ app/
│  ├─ layouts/default.vue  # 侧边导航 + 顶栏 + 面包屑（Naive UI Layout）
│  ├─ middleware/auth.global.ts   # 校验登录态，未登录跳 /login
│  ├─ pages/
│  │   ├─ login.vue
│  │   ├─ index.vue                # 工作台
│  │   ├─ users/index.vue · [id].vue
│  │   ├─ orders/index.vue · [id].vue · refunds.vue
│  │   ├─ silkbag/index.vue
│  │   ├─ plans/index.vue
│  │   ├─ signals/rules.vue · records.vue
│  │   ├─ content/{teaching,news,banner,announcement}.vue
│  │   ├─ push/index.vue
│  │   └─ system/{admins,roles,audit,login-logs}.vue
│  ├─ composables/  useAdminApi / useAuth / usePermission / usePagination
│  └─ directives/ permission.ts    # v-permission="'user.membership.edit'"
└─ server/api/[...path].ts # BFF：cookie→Bearer 转发 /api/admin/*
```

- **鉴权流**：登录成功 → 后端下发 AdminJwt → 写入 **httpOnly + SameSite=Strict** cookie（前端 JS 取不到，抗 XSS 窃取）。后续请求经 Nuxt server BFF，从 cookie 读 token 注入 `Authorization: Bearer`，转发 WebApi。
- **权限渲染**：登录后拉 `GET /api/admin/auth/me` 得权限点集合，`usePermission`/`v-permission` 控制菜单与按钮显隐；**但真正的拦截在后端**。
- **CSRF 防护**：httpOnly + SameSite=Strict cookie + BFF 校验 `Origin`/`Referer` + 写操作带自定义 header。

## 2.3 后端技术方案

### 2.3.1 独立 Admin 鉴权（新增 AuthenticationScheme）
- 新增 scheme `AdminJwt`，**独立 SecretKey/Issuer/Audience**（与 C 端 `Jwt` 隔离，互不可冒用），claims：`adminId`、`adminName`、`role`、`perms`（或 role→perms 服务端解析）、`jti`。
- 复用 C 端单点登录思路（`SessionService` 模式）做 Admin 端会话与踢出。
- 在 `MultiAuth` PolicyScheme 基础上扩展：`/api/admin/*` 强制走 `AdminJwt`。

### 2.3.2 RBAC 授权
- **MVP 简化**：角色用枚举（`super/ops/support/finance/auditor`），权限点用代码常量 `AdminPermissions`，`role→perms` 映射写在服务端（一张静态映射 + 可被 DB 覆盖）。
- 注册 `AddAuthorization`，每个权限点一条 policy：`[Authorize(AuthenticationSchemes="AdminJwt", Policy="user.membership.edit")]`。
- **二期扩展**：`Admin_Role` + `Admin_Role_Permission` 表支持自定义角色，无需改代码。

### 2.3.3 操作审计（ActionFilter）
- 全局 `AdminAuditActionFilter`：拦截所有 `/api/admin/*` 的 POST/PUT/DELETE，记录 `adminId/action/module/targetType/targetId/summary/beforeJson/afterJson/ip/ua` → `Admin_Audit_Log`。
- 写型服务可选实现 `IAuditableChange` 暴露 before/after 快照。
- `SilkBagUpdateLog.OperUserId` 等既有痕迹位接入统一 `adminId`。

### 2.3.4 「去配置化」迁移策略（M5/M6 前置）
| 配置 | 现状 | 目标 | 改动点 |
|---|---|---|---|
| 会员定价 | `appsettings:SpdexBilling.MembershipPlans` | `Membership_Plan`+`Membership_Price_Stage` | `NewSpdexMembershipCatalog` 改读 repo+`ISpdexCache`，保留硬编码兜底 |
| 信号规则 | `appsettings:SignalEngine.Models` | `Signal_Rule`（JSON 列） | `SignalMonitorService` 改周期性从 DB 热加载 |

> 迁移采用「**双读兼容**」：先建表并把现有配置一次性导入，代码改为「DB 有则用 DB、无则回落 appsettings」，灰度确认后再删配置。

### 2.3.5 复用与新增端点
- **直接复用**（迁鉴权即可）：`SilkBagAdminController`（9 端点）、`AdminTeaching2026Controller`（3 端点）、`AdminController`（令牌 7 端点）。详见附录 A。
- **需新增**：详见附录 B。

## 2.4 数据模型设计（新增表 DDL 草案）

> SQL Server 2008 R2 兼容（`NVARCHAR(MAX)` 存 JSON，不用 `JSON` 类型）；命名沿用现有下划线风格（参照 `Signal_Record`、`Teaching_Channel_Match`）。

```sql
-- 管理员账号
IF OBJECT_ID('dbo.Admin_User') IS NULL
CREATE TABLE dbo.Admin_User (
    AdminUserId   INT IDENTITY(1,1) PRIMARY KEY,
    UserName      NVARCHAR(64)  NOT NULL UNIQUE,
    PasswordHash  NVARCHAR(256) NOT NULL,       -- PBKDF2/BCrypt
    DisplayName   NVARCHAR(64)  NOT NULL,
    RoleCode      NVARCHAR(32)  NOT NULL,        -- super/ops/support/finance/auditor
    Email         NVARCHAR(128) NULL,
    Mobile        NVARCHAR(32)  NULL,
    Status        INT NOT NULL DEFAULT 1,        -- 1 启用 / 0 禁用
    LastLoginAt   DATETIME NULL,
    LastLoginIp   NVARCHAR(64) NULL,
    CreatedAt     DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt     DATETIME NULL
);

-- 操作审计（只增不删）
IF OBJECT_ID('dbo.Admin_Audit_Log') IS NULL
CREATE TABLE dbo.Admin_Audit_Log (
    Id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    AdminUserId INT NOT NULL,
    AdminName   NVARCHAR(64) NOT NULL,
    Module      NVARCHAR(32) NOT NULL,           -- user/order/silk/plan/signal/...
    Action      NVARCHAR(64) NOT NULL,           -- membership.edit / refund.approve ...
    TargetType  NVARCHAR(32) NULL,
    TargetId    NVARCHAR(64) NULL,
    Summary     NVARCHAR(512) NULL,
    BeforeJson  NVARCHAR(MAX) NULL,
    AfterJson   NVARCHAR(MAX) NULL,
    Ip          NVARCHAR(64) NULL,
    UserAgent   NVARCHAR(256) NULL,
    CreatedAt   DATETIME NOT NULL DEFAULT GETDATE()
);
CREATE INDEX IX_Admin_Audit_Created ON dbo.Admin_Audit_Log(CreatedAt);
CREATE INDEX IX_Admin_Audit_Admin   ON dbo.Admin_Audit_Log(AdminUserId);

-- 登录日志
IF OBJECT_ID('dbo.Admin_Login_Log') IS NULL
CREATE TABLE dbo.Admin_Login_Log (
    Id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserName   NVARCHAR(64) NOT NULL,
    Success    BIT NOT NULL,
    FailReason NVARCHAR(128) NULL,
    Ip         NVARCHAR(64) NULL,
    UserAgent  NVARCHAR(256) NULL,
    CreatedAt  DATETIME NOT NULL DEFAULT GETDATE()
);

-- 会员定价（去配置化）
IF OBJECT_ID('dbo.Membership_Plan') IS NULL
CREATE TABLE dbo.Membership_Plan (
    RoleId          INT PRIMARY KEY,
    RoleName        NVARCHAR(32) NOT NULL,
    RoleDescription NVARCHAR(256) NULL,
    DiscountDes     NVARCHAR(128) NULL,
    Hot             INT NOT NULL DEFAULT 0,
    Unit            NVARCHAR(16) NULL,
    DisplayOrder    INT NOT NULL DEFAULT 99,
    Enabled         BIT NOT NULL DEFAULT 1,
    UpdatedAt       DATETIME NULL
);
IF OBJECT_ID('dbo.Membership_Price_Stage') IS NULL
CREATE TABLE dbo.Membership_Price_Stage (
    StageId   INT PRIMARY KEY,
    RoleId    INT NOT NULL,
    StageName NVARCHAR(32) NOT NULL,
    Price     DECIMAL(18,2) NOT NULL,
    Month     DECIMAL(5,2) NOT NULL,
    Days      INT NOT NULL,
    Enabled   BIT NOT NULL DEFAULT 1
);

-- 信号规则（去配置化，条件存 JSON）
IF OBJECT_ID('dbo.Signal_Rule') IS NULL
CREATE TABLE dbo.Signal_Rule (
    RuleId      NVARCHAR(64) PRIMARY KEY,
    ModelName   NVARCHAR(64) NOT NULL,
    Enabled     BIT NOT NULL DEFAULT 1,
    ConfigJson  NVARCHAR(MAX) NOT NULL,          -- 条件/阈值/wait/reversal
    UpdatedBy   NVARCHAR(64) NULL,
    UpdatedAt   DATETIME NOT NULL DEFAULT GETDATE()
);

-- 退款工单（M3，当前缺失）
IF OBJECT_ID('dbo.Order_Refund') IS NULL
CREATE TABLE dbo.Order_Refund (
    Id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    OrderId     NVARCHAR(64) NOT NULL,
    UserId      INT NOT NULL,
    Amount      DECIMAL(18,2) NOT NULL,
    Reason      NVARCHAR(256) NOT NULL,
    Status      INT NOT NULL DEFAULT 0,          -- 0 待审批/1 已批/2 驳回/3 已退款
    RequestedBy NVARCHAR(64) NOT NULL,
    ApprovedBy  NVARCHAR(64) NULL,
    CreatedAt   DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt   DATETIME NULL
);

-- 内容（P2）
-- Content_Banner / Content_Announcement：略，结构 = Id/Title/ImageUrl/Link/Sort/Enabled/StartAt/EndAt/...
```

## 2.5 安全设计（碰钱模块，重点）

| 维度 | 措施 |
|---|---|
| 认证 | AdminJwt 短时效（如 60min）+ 刷新；密码 PBKDF2/BCrypt；登录失败 5 次锁定 15min |
| 授权 | 后端逐端点 policy；列表/详情按权限脱敏；越权 403；**前端权限仅控显隐，不作信任边界** |
| 网络 | nginx `allow <运营出口IP>; deny all;`；HTTPS 独立证书；Swagger 在 admin 段关闭 |
| 会话 | httpOnly + Secure + SameSite=Strict cookie；单点登录踢出；空闲超时 |
| 敏感操作 | 二次确认；调账/退款理由必填；大额（> 阈值）需 `finance`/`super`；金额与影响行数预览 |
| 审计 | 全写操作留痕（含改前改后），日志不可删；定期导出归档 |
| 注入/越权 | 沿用参数化 SQL；服务端校验目标归属；CSRF（SameSite + Origin 校验） |
| 2FA | 二期 TOTP，super/finance 强制 |

## 2.6 部署方案

### docker-compose（新增 service）
```yaml
frontend-admin:                          # 镜像由 GitHub Actions 构建并推 Aliyun ACR；服务器仅 pull/up，不在服务器 build
  image: ${IMAGE_ADMIN:-spdex.frontend.admin:latest}
  network_mode: host
  environment:
    - NUXT_PORT=3005
    - PORT=3005
    - NITRO_PORT=3005
    - NUXT_PUBLIC_REQUIRE_AUTH=true
    - NUXT_ADMIN_API_INTERNAL_URL=http://127.0.0.1:5000
    - NUXT_PUBLIC_ADMIN_PUBLIC_BASE_URL=https://admin.spdex.com
  restart: unless-stopped
```

### Dockerfile
- Node 22-alpine 两阶段（`npm ci` + `nuxt build` → `.output/server/index.mjs`），`EXPOSE 3005`（照搬 Quantilearn）。

### nginx（新增 `deploy/nginx/admin.spdex.com.ssl.conf`）
```nginx
server {
  server_name admin.spdex.com;
  # —— IP 白名单 ——
  allow  <运营出口IP-1>;
  allow  <运营出口IP-2>;
  deny   all;
  location / { proxy_pass http://127.0.0.1:3005; proxy_set_header Host $host; }
  # 443 + HTTP→HTTPS 跳转 + 证书：照 ql.spdex.com.ssl.conf
}
```

### CI/CD（`.github/workflows/deploy.yml`）
- `detect` 步增加路径 `Spdex.Frontend.Admin/*`；新增镜像变量 `IMAGE_ADMIN`；`build`/`deploy` 增对应 job；沿用 commit message `[build]`/`[deploy]` 触发 + Aliyun ACR 推送。

---

# 第三部分 · 开发计划

## 3.1 里程碑总览

| 阶段 | 主题 | 交付物 | 估算（1–2 全栈） |
|---|---|---|---|
| **P0a** | 基建 + 最小可用后台（先上线） | 鉴权/RBAC/审计 + 前端脚手架 + 部署 + M9 + M2 用户会籍 + M4 锦囊查询/小额调账 + `ComputeNewEndDate` 重构 | ~2.5–3 周 |
| **P0b** | 订单与对账 | M3 订单查询 + 退款工单（新建链路）+ 只读对账 | ~1–1.5 周 |
| **P1** | 去配置化 + 运营 | M5 套餐、M6 信号热加载、M7 教学/News、M1 工作台 | ~3 周 |
| **P2** | 增强 | M8 推送、Banner/公告、2FA、退款自动化、BI、自定义角色 | ~2–3 周 |

> 估算为相对工作量，假设 1–2 名全栈、后端复用现有基建。绝对排期视人手而定。

## 3.2 P0 任务分解（WBS）

**基建（阻塞后续，最先做）**
1. 后端：`Admin_User`/`Admin_Audit_Log`/`Admin_Login_Log` 建表 + 实体/映射/repo（脚本入 `Spdex.Core/scripts/`）。
2. 后端：`AdminJwt` scheme + 登录/刷新/me/登出 + 密码哈希 + 登录限流。
3. 后端：RBAC policy（枚举角色 + 权限常量 + role→perms 映射）。
4. 后端：`AdminAuditActionFilter` 审计中间件。
5. 前端：`Spdex.Frontend.Admin` 脚手架（复制 Quantilearn 配置）+ 布局/登录页/BFF/`usePermission`。
6. 运维：Dockerfile + docker-compose service + nginx 配置 + CI/CD 接入。

**功能（依赖基建）**
7. M9 系统：管理员/角色 UI + 审计/登录日志查询。
8. M2 用户会员：搜索/详情/改会籍（复用 `ComputeNewEndDate`）/封禁/重置密码。
9. M4 锦囊：接 `SilkBagAdminController` 现成端点（迁鉴权）+ 余额/调账/流水 UI。
10. M3 订单：订单查询/详情 + `Order_Refund` 工单 + 只读对账。

## 3.3 P1 / P2 摘要
- **P1**：M5（建 `Membership_*` 表 + `NewSpdexMembershipCatalog` 双读迁移 + UI）；M6（建 `Signal_Rule` + `SignalMonitorService` 热加载 + UI）；M7 教学选赛/News UI；M1 工作台。
- **P2**：M8 推送群发/模板；`Content_Banner`/`Content_Announcement`；TOTP 2FA；退款与渠道自动对接；`Admin_Role`/`Admin_Role_Permission` 自定义角色；BI 大盘。

## 3.4 风险与依赖

| 风险 | 影响 | 缓解 |
|---|---|---|
| 「去配置化」改动触及支付/信号核心链路 | 中高 | 双读兼容 + 灰度 + 兜底保留 appsettings |
| 历史订单迁移（旧 `121.42.227.238:8081` 只读源） | 中 | 与脱离 weixin 的迁移合并；后台「历史订单」标只读来源 |
| 升级折算 `ComputeNewEndDate` 边缘 case 未对账 | 中 | 后台改会籍前补充单元测试 + 与旧系统抽样对账 |
| 既有 admin 端点 ApiKey → AdminJwt 迁移 | 低中 | 双轨过渡：先支持两种 scheme，前端切换后再下线 ApiKey |
| 后台直改生产库的破坏力 | 高 | 强制审计 + 二次确认 + 最小权限 + 写操作影响行数预览 |

## 3.5 验收与上线
- 灰度：先开 `super`+`support` 两角色，跑通用户/订单/锦囊后再放运营/财务。
- 回滚：前端独立容器可秒级回滚；DB 变更附 `down` 脚本；去配置化保留 appsettings 兜底。
- 上线前：权限矩阵演练（每角色逐权限点验证越权 403）+ 审计日志抽查 + IP 白名单验证。

---

# 附录

## 附录 A · 现有可复用 admin 端点（迁鉴权即用）

| 控制器 | 方法 | 路由 | 职责 |
|---|---|---|---|
| AdminController | GET/POST | `/api/admin/tokens` | 列出/新增令牌 |
| AdminController | POST | `/api/admin/tokens/generate` | 批量生成令牌 |
| AdminController | PUT/DELETE | `/api/admin/tokens/{code}[/type]` | 改类型/删除（踢出绑定用户） |
| AdminController | GET/DELETE | `/api/admin/tokens/bindings[/{userId}]` | 绑定列表/撤销绑定 |
| SilkBagAdminController | GET | `/api/admin/silkbag/balance/{userId}`、`/balance-by-mobile/{mobile}` | 查余额 |
| SilkBagAdminController | POST | `/api/admin/silkbag/adjust` | 调账（OperUserId 取自鉴权身份） |
| SilkBagAdminController | GET | `/api/admin/silkbag/{update,consume,reward,prorata}-logs` | 四类流水 |
| SilkBagAdminController | GET/POST | `/api/admin/silkbag/config/{sys,pay-reward}` | 运营配置读写 |
| AdminTeaching2026Controller | GET | `/api/admin/teaching2026/soccer-candidates`、`/opened` | 候选/已开放赛事 |
| AdminTeaching2026Controller | PUT | `/api/admin/teaching2026/opened` | 更新开放赛事 |

## 附录 B · 需新增后端端点

```
auth     POST /api/admin/auth/login | refresh | logout      GET /me
admins   GET/POST /api/admin/admins   PUT /{id}/{role,password,status}   GET /roles
audit    GET /api/admin/audit-logs    GET /api/admin/login-logs
users    GET /api/admin/users  GET /{id}  PUT /{id}/membership|status  POST /{id}/reset-password
orders   GET /api/admin/orders  GET /{id}  POST /{id}/refund  GET /reconcile
plans    GET/POST/PUT/DELETE /api/admin/plans   .../plans/{id}/stages
signals  GET/POST/PUT /api/admin/signal-rules   PUT /{id}/enabled   GET /api/admin/signals
content  news/banner/announcement CRUD   GET/PUT /cs-config
push     POST /api/admin/push/broadcast   templates CRUD
dash     GET /api/admin/dashboard/overview
```

## 附录 C · 后台涉及核心实体字段（摘要）

> 完整字段表见取证记录；此处列界面关键列。

- **Users**：UserId / UserName / RoleId / RoleName / EndDate / UserState / MobileNum(脱敏) / Email(脱敏) / RegisterDate / LastActivityDate / LastIp
- **RoleId→等级**：1 保留 / 2 免费 / 3 基础 / 4 专家 / 5 白金 / 9 专业 / 10 黄金 / 11 翡翠 / 12 红宝石 / 13 彩店 / 16 赢在Q群
- **NewSpdexPaymentOrder**：OrderId / UserId / ProductType(0会员/1锦囊) / Channel(alipay/wxcode) / RoleId / StageId / TotalFee / Status(0待付/1已付/2失败) / TradeNo / PaidTime / NotifyRaw
- **SilkBagBalance**：UserId / BagType(1充值/2奖励/3分成) / BagCount
- **SilkBagUpdateLog**：UserId / UpdateBagCount(±) / BagCount(后) / Reason / **OperUserId** / UpdateTime
- **SilkBag_SysConfig**：ConfigType(1充值奖励比/2模型分成比/3订阅所需/4推荐分成比) / Value
- **SilkBag_PayRewardConfig**：PayType / RoleId / RewardCount / StartTime / EndTime / Status(0停/1启)
- **SignalRecord**：SignalId / ModelName / EventId / 主客队 / MatchTime / Status / TriggeredAt / ExecutableAt / ExpiredAt / SnapshotJson
- **TeachingChannelMatch**：ChannelCode / EventId / Sport / OpenDate / IsEnabled / CreatedBy

## 附录 D · 待决策项（评审时确认）

1. `silk.adjust.small` 的金额阈值（建议 ≤100 锦囊）。
2. 退款是否需对接渠道自动退款 API（P2），还是长期人工 + 记录。
3. 客服配置（`CustomerService`）是否迁 DB，还是保留 appsettings + 后台只读。
4. 自定义角色（`Admin_Role` 表）是否纳入 P1，还是 P2 按需。
5. 端口 `3005` 是否与现网其它服务冲突（需运维确认）。
6. AdminJwt 是否需要刷新令牌 + 滑动过期，还是固定 60min 重登。

## 附录 E · 端口 / 子域名 / 环境变量分配

| 前端 | 端口 | 子域名 |
|---|---|---|
| Fjc | 3000 | （现网） |
| 2026 | 3001 | （现网） |
| NewSpdex | 3002 | new.spdex.com |
| Quantilearn | 3004 | ql.spdex.com |
| **Admin（新）** | **3005** | **admin.spdex.com** |

**Admin 后端新增配置段（appsettings / 环境变量）**
```
AdminJwt__SecretKey / Issuer / Audience / ExpirationMinutes
AdminAuth__MaxLoginFailures / LockoutMinutes
SilkBag__SmallAdjustThreshold
```
