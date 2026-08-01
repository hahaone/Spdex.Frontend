# SPdex Frontend 文档中心

本目录是 SPdex 多前端仓库的统一文档入口。后端、AI / MCP 和公共基础设施文档
位于 [`Spdex.Core/docs`](../../Spdex.Core/docs/README.md)。

## 前端项目

| 子项目 | 用途 | 主要文档 |
| --- | --- | --- |
| [`Spdex.Frontend.2026`](../Spdex.Frontend.2026/) | 2026 版主站 | [项目级文档](project/requirements.md) |
| [`Spdex.Frontend.Admin`](../Spdex.Frontend.Admin/) | Admin2026 管理后台 | [需求与技术方案](admin/requirements-and-technical-plan.md) |
| [`Spdex.Frontend.Fjc`](../Spdex.Frontend.Fjc/) | FJC 前端 | [项目级文档](project/README.md) |
| [`Spdex.Frontend.Help`](../Spdex.Frontend.Help/) | SPdex 独立帮助中心 | [Help Center 产品说明](products/help-center/README.md) |
| [`Spdex.Frontend.NewSpdex`](../Spdex.Frontend.NewSpdex/) | NewSpdex 新版前端 | [NewSpdex 文档](products/newspdex/README.md) |
| [`Spdex.Frontend.Quantilearn`](../Spdex.Frontend.Quantilearn/) | Quantilearn 工作台 | [后端仓库中的产品文档](../../Spdex.Core/docs/products/quantilearn/) |

## 文档分类

### 项目基础

- [项目文档导航](project/README.md)
- [需求](project/requirements.md)
- [架构设计](project/architecture.md)
- [开发与部署指南](project/development-guide.md)
- [开发记录](project/development-log.md)

### 产品专项

- [Admin2026 需求与技术方案](admin/requirements-and-technical-plan.md)
- [Help Center 产品说明](products/help-center/README.md)
- [NewSpdex 文档](products/newspdex/README.md)

### 运维与资产

- [Web 节点运维手册](operations/web-node-operations.md)
- [品牌素材](assets/brand/)

## 目录约定

1. 跨前端通用内容放在 `project/`，产品专属内容放在 `products/<product>/`。
2. 发布、节点、回滚和排障放在 `operations/`。
3. 原始设计稿和表格不与实施文档混放；可公开维护的参考材料放在
   `references/`，本地敏感或大文件源稿放在被 Git 忽略的 `local-source/`。
4. 新文档不再直接放在 `docs/` 根目录，移动文件时同步修正跨仓库引用。
