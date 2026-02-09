# Spdex Frontend - 开发记录

## 记录格式

每条记录包含：日期、作者、变更内容、相关说明。

---

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
