# Spdex Frontend - 设计文档

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Nuxt | 4.x | 全栈 Vue 框架（SSR/SSG） |
| Vue | 3.x | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Vue Router | 5.x | 路由管理 |
| ESLint | 9.x | 代码规范 |

## 项目架构

```
Spdex.Frontend/                 # 仓库根目录
├── .gitignore                  # Git 忽略规则
├── docs/                       # 项目文档
│   ├── requirements.md         # 需求文档
│   ├── design.md               # 设计文档
│   ├── implementation.md       # 实施方案
│   └── dev-log.md              # 开发记录
└── Spdex.Frontend.Fjc/         # Nuxt 3 主应用
    ├── app/                    # 应用层
    │   ├── app.vue             # 根组件
    │   ├── assets/css/         # 全局样式
    │   ├── composables/        # 组合式函数
    │   ├── layouts/            # 布局组件
    │   ├── pages/              # 页面路由
    │   └── types/              # TypeScript 类型定义
    ├── server/                 # 服务端（Nitro）
    ├── nuxt.config.ts          # Nuxt 配置
    ├── package.json            # 依赖管理
    └── tsconfig.json           # TypeScript 配置
```

## 关键设计决策

### 1. SSR 模式

项目启用服务端渲染（`ssr: true`），优势：
- SEO 友好
- 首屏加载性能更优
- 可按需切换为 SPA 模式

### 2. API 代理

开发环境通过 Nuxt `routeRules` 将 `/api/**` 请求代理到后端：
```
前端 /api/** → 后端 http://localhost:5000/api/**
```

### 3. 运行时配置

使用 Nuxt `runtimeConfig` 管理环境变量：
- `NUXT_PUBLIC_API_BASE` - 后端 API 地址（客户端可访问）
- `apiSecret` - 服务端专用密钥

### 4. 自动导入

Nuxt 自动导入以下目录的模块：
- `composables/` - 组合式函数（如 `useApiFetch`、`useApiHealth`）
- `types/` - TypeScript 类型定义

### 5. 代码规范

使用 `@nuxt/eslint` 模块统一代码风格，通过 `npm run lint` 检查。

---

> 设计变更时请同步更新本文档。
