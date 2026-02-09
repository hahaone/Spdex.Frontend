# Spdex Frontend - 实施方案

## 开发环境搭建

### 前置条件

- Node.js >= 18.x
- npm >= 9.x
- Spdex.WebApi 后端服务运行在 `http://localhost:5000`

### 安装与启动

```bash
# 进入子项目目录
cd Spdex.Frontend.Fjc

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 环境配置

复制 `.env.example` 为 `.env` 并根据需要修改：

```bash
cp .env.example .env
```

环境变量说明：

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NUXT_PUBLIC_API_BASE` | `http://localhost:5000` | 后端 API 地址 |

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run generate` | 静态站点生成 |
| `npm run preview` | 预览生产构建 |
| `npm run lint` | ESLint 代码检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run typecheck` | TypeScript 类型检查 |

## 开发规范

### 目录约定

- 页面文件放入 `app/pages/`，Nuxt 自动生成路由
- 可复用组合式函数放入 `app/composables/`
- TypeScript 类型定义放入 `app/types/`
- 布局组件放入 `app/layouts/`
- 全局样式放入 `app/assets/css/`

### 代码规范

- 使用 TypeScript 严格模式
- 提交前执行 `npm run lint` 和 `npm run typecheck`
- 遵循 Vue 3 Composition API 风格

## 构建与部署

### 构建

```bash
npm run build
```

构建产物输出到 `.output/` 目录。

### 部署

Nuxt 3 支持多种部署方式：
- **Node.js 服务器**: 直接运行 `.output/server/index.mjs`
- **静态托管**: 使用 `npm run generate` 生成静态文件
- **Vercel / Netlify**: Nuxt 3 原生支持

---

> 实施方案变更时请同步更新本文档。
