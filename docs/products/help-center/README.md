# SPdex Help Center 产品说明

版本：2026-08-01 试点实现记录

## 1. 定位

SPdex Help Center 是计划面向公开用户提供的独立帮助中心。公开版建议部署在独立帮助域名，例如 `help.spdex.com` 或 `docs.spdex.com`，长期覆盖：

- SPdex AI 观察助手和 SPdex AI MCP。
- NewSpdex 赛事、指数、成交、时光机、会员权限。
- FJCX 专家分析、窗口、Hold、共振和提炼表。
- Quantilearn、闪Q和学习工具。
- 账号、会员、支付、客服、工单和问题升级。

当前阶段只实现 AI 相关帮助内容，不对正式用户承诺全站帮助中心已经发布。

## 2. 当前实现

新增独立 Nuxt 应用 `Spdex.Frontend.Help`：

- 首页提供帮助搜索、AI 文档入口、未来分类占位和客服反馈提示。
- `/ai` 提供 AI 帮助专区。
- `/ai/:slug` 提供文章页，当前包含：
  - AI 观察助手入门。
  - SPdex AI MCP 接入。
  - 数据与分析口径。
  - Watch Condition 与通知。
  - FAQ 与安全边界。
- 使用 SPdex 现有 Logo/Favicon 作为视觉资产。
- 提供 Dockerfile，默认容器端口为 `3006`。

## 3. 命名口径

用户侧统一使用“SPdex AI 观察助手”或“AI 观察助手”。旧测试文档或内部讨论中的 `Good Sample` 只作为历史内部代号解释，不再作为主要用户侧名称。

内部接口、类型和存储 key 暂不强行重命名，避免破坏已经实现的 AI gateway、golden sample、审计和测试链路。

## 4. 发布边界

本阶段没有把 Help Center 接入生产 Ansible/Nginx/GitHub Actions 自动部署链路，也没有修改正式服务器。原因：

- 当前 Web 节点同时承载正式前端和跳板职责，不能因为帮助中心雏形影响现有增量发布。
- 第六个前端服务如果过早进入生产 compose 服务清单，会要求线上节点先有对应容器，否则后续增量部署可能失败。
- 公开域名、证书、ALB、Nginx host、客服入口和内容审核流程仍需单独确认。

## 5. 后续计划

1. 补齐全站帮助分类内容和客服/工单交互设计。
2. 确认公开域名、证书、CDN/ALB 和是否需要独立仓库或现有前端仓库部署。
3. 将 `Spdex.Frontend.Help` 安全接入构建和发布流水线。
4. 在 NewSpdex、FJCX、Quantilearn 和 Admin 中增加帮助入口。
5. 建立内容审核、版本记录和用户反馈闭环。
