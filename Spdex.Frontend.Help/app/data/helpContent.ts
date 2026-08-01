export interface HelpSection {
  heading: string
  body: string[]
  bullets?: string[]
  examples?: string[]
}

export interface HelpArticle {
  slug: string
  title: string
  summary: string
  audience: string
  status: '试点' | '可读' | '安全'
  readMinutes: number
  sections: HelpSection[]
}

export interface FutureCategory {
  title: string
  summary: string
  status: string
}

export const aiArticles: HelpArticle[] = [
  {
    slug: 'ai-watch-assistant',
    title: 'AI 观察助手入门',
    summary: '在 NewSpdex 站内用自然语言查看比赛、盘口、成交、异常和简报。',
    audience: 'NewSpdex 试点用户',
    status: '试点',
    readMinutes: 6,
    sections: [
      {
        heading: '它是什么',
        body: [
          'SPdex AI 观察助手是 NewSpdex 站内的受控足球数据问答入口。它使用同一套 SPdex AI 工具和数据口径，但不要求用户配置 MCP 客户端或复制 token。',
          '旧测试文档或群内口径里的 Good Sample，指的就是现在的 SPdex AI 观察助手。正式对外文案应优先使用新名称。',
        ],
      },
      {
        heading: '适合先问什么',
        body: [
          '建议先定位比赛，再查看单场，再追问某类走势、成交、专家摘要或外部预测市场。这样可以减少跨赛事串场，也更容易保留证据链。',
        ],
        examples: [
          '今天有哪些重点比赛？',
          '搜索今天阿森纳相关比赛。',
          '查看这场比赛快照。',
          '这场亚洲指数最近怎么变化？',
          '给我生成一份赛前观察简报。',
        ],
      },
      {
        heading: '怎样理解回答',
        body: [
          '回答里的排行、异常、Hold、共振、外部预测市场差异，都只能理解为市场观察。它们不是投注建议、胜负推荐或确定性预测。',
        ],
        bullets: [
          '优先确认 match_id、主客队、联赛和比赛时间是否正确。',
          '查看数据截止时间、missing_fields 和 permission_locked。',
          '复杂结论应带 evidence refs 或可追溯字段。',
          '遇到问题时保留问题原文、时间和 trace_id。',
        ],
      },
      {
        heading: '试点可见性',
        body: [
          '当前 AI 观察助手仍受账号权限、测试白名单和前端运行时开关控制。看不到入口通常表示当前账号或环境未开放，并不代表 NewSpdex 主站故障。',
        ],
      },
    ],
  },
  {
    slug: 'mcp-quickstart',
    title: 'SPdex AI MCP 接入',
    summary: '把 SPdex 足球数据工具接入 WorkBuddy、Claude、Cursor 或企业 Agent。',
    audience: 'MCP 用户和企业 Agent',
    status: '试点',
    readMinutes: 8,
    sections: [
      {
        heading: '适用场景',
        body: [
          'SPdex AI MCP 面向希望在外部 Agent 中调用 SPdex 数据的高级用户或企业团队。它适合多轮分析、自动观察列表、内部报告和工作流集成。',
          '如果你只想在 NewSpdex 页面里直接提问，应优先使用 AI 观察助手。',
        ],
      },
      {
        heading: '试点服务地址',
        body: [
          '测试期 Remote MCP 地址为 https://mcp-test.spdex.com/mcp。未来正式商业地址计划为 https://mcp.spdex.com/mcp，只有在产品、合规、专家验证和商业化门禁完成后才对外使用。',
        ],
      },
      {
        heading: '鉴权方式',
        body: [
          '个人用户优先使用账号中心创建的一次性展示 MCP token；支持 remote OAuth 的客户端可走授权码和 PKCE；企业系统使用合同、scope、IP 白名单和额度约束下的企业凭证。',
        ],
        bullets: [
          '个人 token 通常以 spdx_mcp_ 开头，只显示一次。',
          'OAuth 授权可以在账号中心或客户端撤销。',
          '企业凭证不依赖某个员工个人会员，但会严格受合同控制。',
          '不要把 Authorization header、token、cookie 或本地配置文件发给聊天模型。',
        ],
      },
      {
        heading: '推荐 Agent 指令',
        body: [
          '项目指令应要求 Agent 优先使用 SPdex MCP 查询赛事、盘口、指数、成交、异常、外部预测市场、赛中信号或字段解释，不要用网页搜索替代 SPdex 数据，也不要凭记忆编造 match_id、赔率、成交或结论。',
        ],
      },
    ],
  },
  {
    slug: 'data-methods',
    title: '数据与分析口径',
    summary: '理解 NewSpdex、FJCX、外部预测市场、赛中信号和报告字段。',
    audience: '希望看懂结果的用户',
    status: '可读',
    readMinutes: 9,
    sections: [
      {
        heading: '总原则',
        body: [
          'SPdex AI 只基于工具返回的数据回答。有数据就说明证据，没有数据就说明缺失或权限锁定；排行、异常、共振和预测市场差异都只作为观察。',
        ],
      },
      {
        heading: '主要数据来源',
        body: [
          'NewSpdex 覆盖赛事列表、盘口分区、走势、成交、深度、重大成交、赛中快照和活跃信号。FJCX 覆盖 BigHold、多窗口、2σ/3σ、提炼表和跨市场共振。外部预测市场覆盖 Polymarket/Kalshi 的链接、概率、成交、订单簿和差异。',
        ],
      },
      {
        heading: '常见字段',
        body: [
          'match_id 是 SPdex 内部赛事 ID，适合多轮追问使用。market 表示市场或盘口类型；selection 表示选项；price 表示价格、赔率或盘口价位；volume/turnover 表示成交量，但不同市场和平台不能直接混用。',
        ],
        bullets: [
          'missing_fields 表示数据缺失，不等于 0。',
          'permission_locked 表示字段存在但当前账号或 token 无权查看。',
          'rank_score/watch_score 是观察排序分，不是胜率。',
          'implied_probability 是价格推导的归一概率，不是预测模型承诺。',
        ],
      },
      {
        heading: '分析方法边界',
        body: [
          'Hold、2σ/3σ、成交流、盘口深度、跨市场共振和外部预测市场背离，都用于解释市场现象。它们可以帮助确定下一步看什么，但不能自动推导投注结论。',
        ],
      },
    ],
  },
  {
    slug: 'watch-condition',
    title: 'Watch Condition 与通知',
    summary: '把“如果出现某类信号就提醒我”的需求整理成可确认的观察条件。',
    audience: '高级试点用户',
    status: '试点',
    readMinutes: 5,
    sections: [
      {
        heading: '它解决什么问题',
        body: [
          'Watch condition 是观察条件，不是交易指令。它把用户的提醒需求转成可保存、可评估、可撤销的结构化条件，并通过 outbox 生命周期记录通知状态。',
        ],
      },
      {
        heading: '推荐流程',
        body: [
          '试点阶段应先生成草稿，再确认创建。AI 观察助手和 MCP 都可以准备草稿，但只有明确 confirm=true 且账号有写权限时才会创建 active 条件。',
        ],
        examples: [
          '为这场预测市场背离准备一个提醒草稿，不要创建。',
          '列出我当前 active 的观察条件。',
          '取消这个观察条件。',
        ],
      },
      {
        heading: '通知边界',
        body: [
          '站内收件箱、邮件和 webhook 均有独立开关、偏好和白名单。即使 AI 观察助手可见，也不代表通知外发自动对正式用户开放。',
        ],
      },
    ],
  },
  {
    slug: 'safe-usage',
    title: 'FAQ 与安全边界',
    summary: '处理权限、空数据、额度、分享、token 泄露和反馈问题。',
    audience: '所有 AI 用户',
    status: '安全',
    readMinutes: 7,
    sections: [
      {
        heading: '常见权限问题',
        body: [
          '看不到 AI 入口通常表示账号、白名单或前端开关未开放。MCP 调用失败时，应先检查 token/OAuth/企业凭证是否有效，会员或合同 scope 是否覆盖所需工具。',
        ],
      },
      {
        heading: '常见错误',
        body: [
          'permission_denied 表示没有授权、会员不足或合同不允许；quota_exceeded 表示当前主体达到每日额度；validation_error 表示日期、match_id、market、limit 等参数不合规；结果为空可能来自没有比赛、无市场数据、权限不足或上游缺失。',
        ],
      },
      {
        heading: '分享前检查',
        body: [
          '分享 AI 观察助手或 MCP 客户端对话前，应删除完整 token、Authorization header、cookie、JWT、本地 MCP 配置文件、企业合同、IP、scope 或额度信息。',
        ],
        bullets: [
          'token 只给客户端配置，不给聊天模型阅读。',
          '能用站内 AI 观察助手，就不要手工复制 token。',
          '复杂结果先 compact，再按字段下钻。',
          '异常和共振只当观察，不当投注指令。',
        ],
      },
      {
        heading: '如何反馈',
        body: [
          '反馈时请提供使用入口、客户端名称和版本、问题原文、时间、match_id、可见 trace_id 和截图。截图或导出内容必须先删除 token、header 和账号敏感信息。',
        ],
      },
    ],
  },
]

export const futureCategories: FutureCategory[] = [
  {
    title: '赛事与指数',
    summary: 'SPdex 主站赛事列表、详情页、指数成交、时光机和数据权限。',
    status: '后续整理',
  },
  {
    title: 'FJCX 专家分析',
    summary: '专家窗口、提炼表、Hold、共振、显著性阈值和历史回看。',
    status: '后续整理',
  },
  {
    title: '会员与账号',
    summary: '会员权益、升级、发票、设备、密码、客服 QQ 和账号安全。',
    status: '后续整理',
  },
  {
    title: 'Quantilearn 与学习工具',
    summary: '闪Q、训练记录、课程入口和跨产品登录。',
    status: '后续整理',
  },
  {
    title: '客服与工单',
    summary: '正式帮助域名上线后承接在线客服、问题分类、状态追踪和升级流程。',
    status: '规划中',
  },
]

export const supportChecklist = [
  '请优先提供问题原文、发生时间和可见 trace_id。',
  '涉及比赛时提供 match_id、联赛、主客队和开赛时间。',
  '截图或导出内容应先删除 token、Authorization、cookie 和账号敏感信息。',
  '试点阶段 AI 通知、站内收件箱、邮件和 webhook 仍可能受单独开关控制。',
]

export function findArticle(slug: string): HelpArticle | undefined {
  return aiArticles.find(article => article.slug === slug)
}
