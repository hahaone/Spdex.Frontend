export type HelpStatus = '指南' | '参考' | '安全' | '专题' | '进阶'
export type HelpLevel = '入门' | '进阶' | '专家'
export type HelpCategoryId = 'ai' | 'betfair' | 'poly' | 'live' | 'tools'

export interface HelpMetric {
  label: string
  value: string
  description: string
}

export interface HelpTable {
  headers: string[]
  rows: string[][]
}

export interface HelpCallout {
  title: string
  body: string
  tone?: 'info' | 'warning' | 'success'
}

export interface HelpSection {
  heading: string
  body: string[]
  bullets?: string[]
  steps?: string[]
  examples?: string[]
  metrics?: HelpMetric[]
  table?: HelpTable
  callout?: HelpCallout
}

export interface HelpArticle {
  slug: string
  title: string
  summary: string
  audience: string
  status: HelpStatus
  level: HelpLevel
  readMinutes: number
  category: HelpCategoryId
  updated: string
  tags: string[]
  sections: HelpSection[]
}

export interface HelpCategory {
  id: HelpCategoryId
  title: string
  summary: string
  eyebrow: string
}

export interface LearningPath {
  title: string
  summary: string
  articleSlugs: string[]
}

export interface GlossaryTerm {
  term: string
  category: string
  definition: string
}

export const helpCategories: HelpCategory[] = [
  {
    id: 'ai',
    title: 'AI 与 MCP',
    summary: 'AI 观察助手、Remote MCP、数据口径、观察条件和安全边界。',
    eyebrow: '智能助手',
  },
  {
    id: 'betfair',
    title: '必发指数',
    summary: '买卖、主力资金、有效成交、量价时空、共振、锁仓和成交结构。',
    eyebrow: '指数基础',
  },
  {
    id: 'poly',
    title: 'Poly 指数',
    summary: 'Polymarket 预测市场、Poly 与必发差异、大热、背离和 BP 量比。',
    eyebrow: '预测市场',
  },
  {
    id: 'live',
    title: '现场与赛中',
    summary: '毫秒级成交、TOP10 大单、有效击穿、xG 进球期望和赛中观察。',
    eyebrow: '赛中观察',
  },
  {
    id: 'tools',
    title: '竞彩与工具',
    summary: '竞彩工作室、比分明细、闪Q价位、进球模型和操作检查清单。',
    eyebrow: '工具操作',
  },
]

export const helpArticles: HelpArticle[] = [
  {
    slug: 'ai-watch-assistant',
    title: 'AI 观察助手入门',
    summary: '在 NewSpdex 站内用自然语言查看比赛、盘口、成交、异常和简报。',
    audience: 'NewSpdex 用户',
    status: '指南',
    level: '入门',
    readMinutes: 6,
    category: 'ai',
    updated: '2026-08-01',
    tags: ['AI', 'NewSpdex', '自然语言'],
    sections: [
      {
        heading: '它是什么',
        body: [
          'SPdex AI 观察助手是 NewSpdex 站内的足球数据问答入口。它使用 SPdex 的赛事、盘口、成交、指数和赛中数据，适合快速定位比赛、查看快照和追问走势。',
          '如果你只需要在站内提问，不需要配置 MCP 客户端，也不需要手工复制 token。',
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
        heading: '入口与权限',
        body: [
          'AI 观察助手是否可见取决于账号权限和功能开通范围。看不到入口时，优先确认当前账号、会员权益或企业权限是否覆盖对应功能。',
        ],
      },
    ],
  },
  {
    slug: 'mcp-quickstart',
    title: 'SPdex AI MCP 接入',
    summary: '把 SPdex 足球数据工具接入 WorkBuddy、Claude、Cursor 或企业 Agent。',
    audience: 'MCP 用户和企业 Agent',
    status: '指南',
    level: '进阶',
    readMinutes: 8,
    category: 'ai',
    updated: '2026-08-01',
    tags: ['MCP', 'Agent', 'OAuth', 'Token'],
    sections: [
      {
        heading: '适用场景',
        body: [
          'SPdex AI MCP 面向希望在外部 Agent 中调用 SPdex 数据的高级用户或企业团队。它适合多轮分析、自动观察列表、内部报告和工作流集成。',
          '如果你只想在 NewSpdex 页面里直接提问，应优先使用 AI 观察助手。',
        ],
      },
      {
        heading: '接入地址',
        body: [
          'Remote MCP 接入地址以账号中心或企业配置页展示为准。配置时请确认客户端支持 HTTPS Remote MCP、授权回调和所需的鉴权方式。',
        ],
      },
      {
        heading: '鉴权方式',
        body: [
          '个人用户优先使用账号中心创建的一次性展示 MCP token；支持 remote OAuth 的客户端可走授权码和 PKCE；企业系统使用合同、scope、IP 限制和额度约束下的企业凭证。',
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
    slug: 'ai-mcp-use-cases',
    title: 'AI 观察助手场景与最佳实践',
    summary: '按真实分析任务组织提问：今日筛选、单场诊断、成交深挖、跨市场对照、赛中观察和 MCP 工作流。',
    audience: 'NewSpdex 用户和 MCP 高级用户',
    status: '指南',
    level: '进阶',
    readMinutes: 8,
    category: 'ai',
    updated: '2026-08-01',
    tags: ['AI', 'MCP', '场景', '工作流'],
    sections: [
      {
        heading: '先按任务提问',
        body: [
          'AI 观察助手适合把多个 SPdex 数据入口串成一个分析过程。提问时最好先说明任务目标，例如筛选今日比赛、诊断单场、查看成交时间分布、比较外部预测市场或生成简报。',
          '这类问题会比只问“怎么看”更容易得到可复核的结论、依据和数据边界。',
        ],
      },
      {
        heading: '普通用户常用场景',
        body: [
          '普通用户可以从今日观察列表开始，再进入单场。每次只追问一个方向，回答会更清楚。',
        ],
        examples: [
          '今天哪些比赛值得先看？只说明数据观察原因。',
          '这场比赛当前最值得关注的 3 个数据点是什么？',
          '这场有没有明显大额交易？是否只是单笔噪声？',
          '这个成交量、亚洲指数或隐含概率是什么意思？',
        ],
      },
      {
        heading: '进阶用户常用场景',
        body: [
          '进阶用户可以把问题拆成量、价、时、空和跨市场复核。重点不是让 AI 给结论，而是让 AI 按固定证据链检查。',
        ],
        examples: [
          '能否查看这场更详细的成交量时间分布？说明峰值时间和方向。',
          '亚洲让球和大小球最近是否同向变化？',
          'Hold、提炼表和跨市场共振有没有共同指向？',
          'Poly/Kalshi 和 SPdex 标盘是否存在背离？说明流动性限制。',
          '这场赛中 xG、现场大单和活跃信号怎么看？',
        ],
      },
      {
        heading: 'MCP 高级用法',
        body: [
          '如果你在 WorkBuddy、Claude、Cursor 或企业 Agent 中接入 SPdex MCP，可以把站内 AI 观察助手当成最佳实践示例：先用自然语言规划，再按工具证据生成结构化报告。',
        ],
        examples: [
          '如果我用 SPdex MCP 做这场赛前复盘，应该按什么工具顺序查？',
          '请生成今天交易活跃优先的观察列表，并给前三场各写一句后续追问。',
          '请按单场分析工作流输出这场的赛前观察简报。',
        ],
      },
      {
        heading: '好问题的结构',
        body: [
          '一个好问题通常包含对象、市场、时间窗口和输出要求。对象可以是今天、某个联赛或某场比赛；市场可以是胜平负、大小球、亚洲让球、成交量或外部预测市场；输出要求可以是一句结论、关键依据、数据边界和下一步追问。',
        ],
        table: {
          headers: ['要素', '示例'],
          rows: [
            ['对象', '今天、英超、赫根 vs 卡尔马、match_id=35869272'],
            ['市场', '成交量、亚洲让球、大小球、标盘、Poly/Kalshi'],
            ['窗口', '最近 15 分钟、过去 6 小时、赛前、赛中'],
            ['输出', '先给结论、列 3 条依据、说明数据限制'],
          ],
        },
      },
      {
        heading: '使用边界',
        body: [
          '排行、异常、共振、外部预测市场差异和信号结果都只能作为市场观察。它们可以帮助你决定下一步看什么，但不是投注建议、胜负推荐或确定收益。',
        ],
        callout: {
          title: '复核原则',
          body: '单个大单、单个指数或单个外部市场差异都不应单独构成结论。优先看时间分布、盘口同步、成交深度和数据缺失说明。',
          tone: 'warning',
        },
      },
    ],
  },
  {
    slug: 'data-methods',
    title: '数据与分析口径',
    summary: '理解 NewSpdex、FJCX、外部预测市场、赛中信号和报告字段。',
    audience: '希望看懂结果的用户',
    status: '参考',
    level: '入门',
    readMinutes: 9,
    category: 'ai',
    updated: '2026-08-01',
    tags: ['数据口径', '字段', 'NewSpdex', 'FJCX'],
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
        callout: {
          title: '使用边界',
          body: '帮助中心会解释指标和观察方法，但不会把任何模型写成确定收益、稳赚或投注指令。',
          tone: 'warning',
        },
      },
    ],
  },
  {
    slug: 'watch-condition',
    title: 'Watch Condition 与通知',
    summary: '把“如果出现某类信号就提醒我”的需求整理成可确认的观察条件。',
    audience: '高级用户',
    status: '指南',
    level: '进阶',
    readMinutes: 5,
    category: 'ai',
    updated: '2026-08-01',
    tags: ['通知', '观察条件', 'Workflow'],
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
          '建议先生成草稿，再确认创建。AI 观察助手和 MCP 都可以准备草稿；只有明确确认且账号具备写权限时，才会创建 active 条件。',
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
          '站内收件箱、邮件和 webhook 均有独立开关、偏好和权限要求。能够使用 AI 观察助手，不代表所有通知渠道都已开启。',
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
    level: '入门',
    readMinutes: 7,
    category: 'ai',
    updated: '2026-08-01',
    tags: ['FAQ', '安全', '权限', 'Token'],
    sections: [
      {
        heading: '常见权限问题',
        body: [
          '看不到 AI 入口通常表示账号权限或功能未开通。MCP 调用失败时，应先检查 token、OAuth 或企业凭证是否有效，会员或合同 scope 是否覆盖所需工具。',
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
  {
    slug: 'betfair-basics',
    title: '必发指数基础：买卖、主力资金与换手',
    summary: '理解必发交易中的买卖、突破、防御、拦截、封锁和换手，建立基础阅读框架。',
    audience: '必发指数新用户',
    status: '专题',
    level: '入门',
    readMinutes: 10,
    category: 'betfair',
    updated: '2026-08-01',
    tags: ['必发', '主力资金', '换手', '热门指数'],
    sections: [
      {
        heading: '先理解买单和卖单',
        body: [
          '必发交易所是撮合市场：买方和卖方价位、数量匹配后才会成交。SPdex 在帮助中心里把买卖解释为市场行为，不直接等同于最终赛果。',
          '买单通常代表资金愿意在当前价格买入某个结果；卖单通常代表资金愿意在当前价格承接或反向表达。但滚球、对冲和跨市场套利会让单笔方向变得复杂。',
        ],
        table: {
          headers: ['概念', '用户应先看什么', '常见误区'],
          rows: [
            ['买单', '价位是否下压、成交量是否足够、是否击穿多档挂牌', '看到买单就直接等同于赛果会打出'],
            ['卖单', '是否只是试盘、是否持续补货、防御价位是否稳定', '看到卖单就一定代表庄家单向否定'],
            ['挂牌', '挂买/挂卖金额与价位层级', '只看成交，不看成交后的盘口深度'],
          ],
        },
      },
      {
        heading: '主力资金的几个典型行为',
        body: [
          '经典教程把主力资金理解为在量和比例上足以影响盘口结构的资金。帮助中心会把它拆成更容易检查的几种形态。',
        ],
        bullets: [
          '突破：资金扫过多个价位，说明当时的主动性和价差穿透较强。',
          '防御：卖方在某个价位附近持续补充流动性，常用于表达“不怕接货”。',
          '拦截：中盘突然出现单向优势挂牌，否定某一方向继续发展的能力。',
          '封锁：买方在关键价位形成优势结构，常与领先或进球能力观察有关。',
          '换手：价位窄幅稳定，但成交集中在相邻价位，说明买卖双方都在同一区间完成博弈。',
        ],
      },
      {
        heading: '换手为什么重要',
        body: [
          '换手不是简单的“方向明确”，而是双方在同一价位区间完成大量成交。它经常说明比赛进程里存在让双方都能处理仓位的节点，例如进球、红牌、迟进球或特定比分经过。',
        ],
        bullets: [
          '平局换手：重点观察是否存在有进球平局或打破滚球平衡的条件。',
          '上盘低位换手：常用于观察强队赢球但进球时间偏后的结构。',
          '下盘高位换手：常用于观察下盘进球或领先能力，同时不等于下盘直接赢球。',
        ],
      },
      {
        heading: '和欧赔、凯利、热门指数一起看',
        body: [
          '经典教程强调，必发成交最好和传统赔率、凯利值、热门指数一起看。热门指数关注热钱在不同市场之间的获利空间，不是单纯的成交百分比。',
        ],
        callout: {
          title: '学习顺序建议',
          body: '先理解买卖和换手，再学习有效成交、时间标记和跨市场共振。这样更不容易把单个大单误读成确定结论。',
          tone: 'info',
        },
      },
    ],
  },
  {
    slug: 'betfair-advanced',
    title: '必发高级：量价时空、锁仓与成交结构',
    summary: '用流动性、成交深度、时间标记和市场结构复核必发成交，避免只凭单个大单下结论。',
    audience: '进阶数据用户',
    status: '进阶',
    level: '进阶',
    readMinutes: 12,
    category: 'betfair',
    updated: '2026-08-01',
    tags: ['量价时空', '锁仓', '共振', '成交结构'],
    sections: [
      {
        heading: '为什么只看买卖方向会失效',
        body: [
          '高级教程指出，公开可见的“单注”往往是分时汇总后的拟合结果，不一定等同于交易所内部的每个 tick。早盘更新频率、临场更新频率和大赛更新频率不同，都会影响单笔属性。',
          '因此帮助中心不建议只看“大买单”或“高盈亏”就下结论，而是把成交放回量、价、时间和盘口空间里验证。',
        ],
      },
      {
        heading: '四个核心维度',
        body: [
          '量价时空是高级必发分析的阅读框架：成交量够不够，价位是否合理，发生在什么时间，是否跨越了关键盘口空间。',
        ],
        metrics: [
          { label: '量', value: '成交量/总量占比', description: '判断这笔交易是否足以改变市场结构。' },
          { label: '价', value: '价位与密集价', description: '比较交易价、密集价、初盘和主流盘口。' },
          { label: '时', value: 'P48 到 PP', description: '不同时间的同一笔成交含义可能完全不同。' },
          { label: '空', value: '成交深度', description: '看交易跨越了几个价位，以及是否击穿挂单层。' },
        ],
      },
      {
        heading: '时间标记怎么读',
        body: [
          'SPdex 工作室版会把成交按距离开赛的时间标记。非临场成交更适合看早盘模型，临场成交则要警惕噪声、首发信息和散户拥挤交易。',
        ],
        table: {
          headers: ['标记', '时间含义', '阅读重点'],
          rows: [
            ['P48/P24/P12', '赛前 48/24/12 小时附近', '早盘合理赔率、流动性进入、锁仓或放量'],
            ['P6/P3/P2/P1', '赛前 6 到 1 小时', '共振、有效成交、非临场大单'],
            ['PS', '首发名单前后窗口', '阵容信息引发的合理赔率重估'],
            ['P0/P/PP', '临场 50 分钟内到 3 分钟内', '成交噪声、对冲、散户集中和最后流动性'],
          ],
        },
      },
      {
        heading: '锁仓、放量和有效成交',
        body: [
          '锁仓通常指当前分时成交量相对前一分时增长不足，说明后续流动性没有继续充足进入。放量表示流动性继续放大。有效成交则要同时考虑成交深度、成交量和价位。',
        ],
        bullets: [
          '锁仓：分时环比低于约 130%，常用于验证早盘高指数后是否缺乏继续接货。',
          '放量：分时环比高于约 200%，说明流动性继续进入，需要重新判断方向。',
          '有效成交：标盘、亚盘、进球盘的有效阈值不同，不能直接互相套用。',
          '共振：同一时间在不同市场出现方向一致的有效成交，比单市场同步更值得关注。',
        ],
      },
      {
        heading: '成交结构专题',
        body: [
          '高级教程还把让球盘、Goal Line 和比分市场纳入成交结构观察。多选项市场中，异常盘口、单一高亮、对手盘对称交易，都可能比普通单笔大单更能解释比赛进程。',
        ],
        bullets: [
          '异动盘口：非常规选项获得成交和高亮时，说明机构可能在观察特定进程。',
          '主 0 盘密集：主场优势被抹平时，要回看排名、价位和成交差异。',
          '对手盘对称：先后在正反盘口高亮，可能说明早盘优势和临场信息更新形成对冲。',
        ],
      },
    ],
  },
  {
    slug: 'poly-index',
    title: 'Poly 指数入门与大热背离',
    summary: '了解 Polymarket 合约、成交量、死亡螺旋和三种大热形态，识别 Poly 指数背后的市场拥挤。',
    audience: 'Poly 指数新用户',
    status: '专题',
    level: '入门',
    readMinutes: 11,
    category: 'poly',
    updated: '2026-08-01',
    tags: ['Poly', 'Polymarket', '大热', '背离'],
    sections: [
      {
        heading: 'Poly 指数是什么',
        body: [
          'Poly 指数来自 Polymarket 预测市场。每个结果可以理解为一个最终兑付 1 美元的合约，合约价格近似代表市场给出的概率。',
          'SPdex 的 Poly 指数按某个结果的已成交合约数量占全场合约成交总量的比例计算，用来观察国际预测市场的热度和资金拥挤程度。',
        ],
      },
      {
        heading: 'Poly 和必发最大的差异',
        body: [
          'Poly 更像累计统计“买卖动作”，必发更强调成交价格和净持仓。临场大量对冲时，Poly 成交量更容易被放大，也更容易出现 90 以上的大热。',
        ],
        table: {
          headers: ['维度', 'Poly 指数', '必发指数'],
          rows: [
            ['计算基础', '合约成交数量占比', '成交价与成交量加权后的占比'],
            ['成交量口径', '买和卖都会累计', '更接近净持仓和价格权重'],
            ['市场机制', 'YES/NO 自动对称，套利快速纠偏', '交易所赔率和盘口深度共同作用'],
            ['常见风险', '虚假繁荣、散户对冲、死亡螺旋', '单笔属性误差、临场噪声、盘口误读'],
          ],
        },
      },
      {
        heading: '三种 Poly 大热形态',
        body: [
          '文档把 Poly 指数 90 以上视为“大热”观察区，但不同时间形成的大热含义不同。帮助中心把它作为风险识别工具，而不是确定性投注策略。',
        ],
        bullets: [
          '早盘大热，全程不退：需要结合必发早盘锁仓、真实流动性和是否无明显跳水。',
          '中盘临场大热暴走：赛前 3 小时到临场快速冲高，同时必发也热，往往要警惕热门拥挤。',
          'Poly 大热背离：Poly 大热，但同方向必发指数偏低，可能说明必发流动性不足或大资金已经离场。',
        ],
      },
      {
        heading: '死亡螺旋如何形成',
        body: [
          '当某一热门结果被持续买入，价格变化会吸引套利资金进入；Poly 又会把所有买卖动作累计到成交量里，散户看到指数越来越高后继续跟随，热度可能被进一步放大。',
          '这个循环会让“看上去越来越热”的结果反而变成高风险拥挤方向。是否成立，需要用必发指数、成交量、BP 量比和高亮共振共同验证。',
        ],
      },
      {
        heading: 'BP 量比和清一色大柱',
        body: [
          '必发 + Poly 的联合观察中，BP 量比用于比较两个市场的热度关系；Poly 单项前三大柱如果来自同一用户和同一方向，需要额外关注其是否是有效注单、是否非 PS 时间、价位是否合理。',
        ],
        bullets: [
          '必发和 Poly 同时主队大热时，先确认 BP 量比是否失衡。',
          'Poly 清一色大柱需要排除大热噪声，最好结合价差颜色、最大柱量和非 PS 时间。',
          'Poly 总成交远高于必发时，要警惕散户对冲造成的虚高。',
        ],
      },
      {
        heading: '新手检查清单',
        body: [
          '查看 Poly 指数时，先做风险确认，再决定是否继续深挖。',
        ],
        steps: [
          '确认 Poly 指数是否进入 90+ 大热区。',
          '比较同方向必发指数是否同步升高，或形成明显背离。',
          '查看 Poly/必发成交量比例，排除异常虚高。',
          '确认是否有工作室高亮共振、有效成交或清一色大柱。',
          '只把结果作为市场观察和复盘依据，不把单个信号当成确定结论。',
        ],
      },
    ],
  },
  {
    slug: 'live-data-xg',
    title: '现场数据与 xG 进球期望',
    summary: '理解“现场”频道里的毫秒级成交、TOP10 大单、有效击穿、横盘和 xG 走势。',
    audience: '赛中观察用户',
    status: '专题',
    level: '进阶',
    readMinutes: 8,
    category: 'live',
    updated: '2026-08-01',
    tags: ['现场', 'xG', '有效大单', '赛中'],
    sections: [
      {
        heading: '现场频道提供什么',
        body: [
          '现场频道面向专业化赛中观察，展示每场赛事的实时 TOP10 成交单明细、金额、方向、第一档挂牌和轻量化 xG 进球期望走势。',
          '完整版覆盖 SPdex 主站赛事，竞彩版覆盖竞彩胜平负赛事。当前回查重点是当日与昨日两天数据。',
        ],
      },
      {
        heading: '成交方向和有效大单',
        body: [
          '成交方向分为买、卖和横盘。有效大单通常指进入该场 TOP10，且金额或价位击穿达到高亮条件的成交。',
        ],
        table: {
          headers: ['字段', '说明', '阅读提示'],
          rows: [
            ['买', '成交后价位上升或买方主导', '结合比分和价位区间判断是否支持进球或领先'],
            ['卖', '成交后价位下跌或卖方主导', '结合是否领先、是否扩大比分和盘口状态阅读'],
            ['横盘', '成交后价位不变', '要看成交价等于挂买价还是挂卖价，以及大单与挂牌量的比例'],
            ['有效击穿', '不同价位段对应不同价差阈值', '只说明当时成交穿透强，不等于确定赛果'],
          ],
        },
      },
      {
        heading: '横盘怎么拆',
        body: [
          '横盘不是没有信息，而是要看主动成交方和挂牌量关系。买 + 横盘、卖 + 横盘都需要比较大单金额和挂卖/挂买金额。',
        ],
        bullets: [
          '买 + 横盘：若大单金额明显大于挂卖金额，说明买方动能仍值得关注。',
          '买 + 横盘：若挂卖金额远高于大单金额，说明卖方承接强。',
          '卖 + 横盘：若大单金额明显大于挂买金额，说明卖方动能更强。',
          '卖 + 横盘：若挂买金额远高于大单金额，说明买方承接仍存在。',
        ],
      },
      {
        heading: 'xG 走势如何使用',
        body: [
          'xG 初始启动值用于观察全场进球形势，启动后的走势变化用于观察后续进球期望。文档中的经验是：初始 xG 高于全场大球盘口、进球后 xG 拉升明显时，应继续观察后续进球能力。',
        ],
        callout: {
          title: '赛中风险',
          body: '现场数据变化快，红牌、伤停、进球取消和盘口重开都会改变含义。赛中结论必须保留时间点和比分上下文。',
          tone: 'warning',
        },
      },
    ],
  },
  {
    slug: 'jc-studio-models',
    title: '竞彩工作室：早盘、共振与进球模型',
    summary: '按早盘有效成交、标盘/亚盘共振、高指数锁仓和进球数模型建立赛前检查清单。',
    audience: '竞彩工作室用户',
    status: '专题',
    level: '专家',
    readMinutes: 12,
    category: 'tools',
    updated: '2026-08-01',
    tags: ['竞彩', '早盘', '共振', '进球模型'],
    sections: [
      {
        heading: '为什么强调早盘',
        body: [
          '竞彩截止时间经常早于临场，传统临场大单方法不完全适用。特训材料把重点放在排除 PP、P、P0 等临场噪声之后的有效成交。',
          '早盘方法不是忽略临场，而是先用非临场有效成交建立观察方向，再用后续分时、共振和成交结构做确认。',
        ],
      },
      {
        heading: '关键时间标记',
        body: [
          '共振模型优先关注 P1、P2、P3，部分场景只看 P1 也可以。PP/P/P0 更接近临场拥挤区，容易受到噪声影响。',
        ],
        table: {
          headers: ['标记', '时间区间', '在竞彩模型中的意义'],
          rows: [
            ['P1', '赛前 1-2 小时', '最常用的早盘/中盘有效成交窗口'],
            ['P2', '赛前 2-3 小时', '适合观察共振和早盘大柱'],
            ['P3', '赛前 3-6 小时', '早盘资金提前进入的重要窗口'],
            ['P6/P12', '赛前 6 小时以上', '适合看高指数、锁仓和低频异动'],
          ],
        },
      },
      {
        heading: '标盘亚盘共振四步',
        body: [
          '共振是多个市场同一时间出现方向一致的大单。特训材料建议先从标盘或亚盘任一端定位，再交叉确认另一个市场。',
        ],
        steps: [
          '在标盘明细按时间查看，只关注 P1、P2、P3 的有效大单。',
          '定位主平客高亮且成交背景也亮起的大柱，确认是否同时具备有效成交和共振。',
          '进入亚盘明细，确认主客亚盘量比位于 0.50-2.00 的合理区间。',
          '查看亚盘大柱对应单，确认触发价位、方向和时间是否符合模型。',
        ],
      },
      {
        heading: '早盘高指数锁仓',
        body: [
          '早盘高指数锁仓模型通常要求 48 小时或 24 小时分时出现高指数和较高成交，随后成交量环比低于约 130%，说明高指数方向没有被持续放量冲散。',
        ],
        bullets: [
          '48 小时高指数 70 以上，80+ 更需要关注。',
          '成交量达到模型阈值后，看 24 小时是否继续维持高指数。',
          '分时环比低于 130% 可视为锁仓观察，200% 以上要警惕放量后的方向变化。',
          '触发大柱价位低于 1.95，且低于密集价更佳。',
        ],
      },
      {
        heading: '进球数模型如何读',
        body: [
          '进球模型通常从指数提炼表、OU 高指数锁仓、Goal Line 和早盘成交结构中寻找线索。帮助中心只提供阅读顺序，不承诺具体进球数结果。',
        ],
        bullets: [
          '指数提炼击穿：关注价位、成交量、总成交量、是否高亮、是否为提炼表最大成交。',
          '指数提炼不击穿：关注白板、单一提炼单、卖或卖+属性以及 P6/P12 时间。',
          'OU 高指数锁仓：关注大球高指数、成交量、分时环比和触发价位。',
        ],
      },
      {
        heading: '注意事项',
        body: [
          '有效大单不是越多越好。单一、干净、非临场、价位合理、跨市场可验证，通常比杂乱大单更易解释。',
        ],
        bullets: [
          '有效大单最好有足够成交量，过低成交不宜过度解读。',
          '标盘 5.00-8.00 之间的大单容易成为价格陷阱。',
          '指数暴动时需要回到具体分时、价位、后续指数和 Poly 成交表现再分析。',
          '卖单模型最好结合进程和对面方向，不要只看卖单字样。',
        ],
      },
    ],
  },
  {
    slug: 'correct-score',
    title: '比分明细：赔率、比例与冷门路径',
    summary: '掌握 6 小时对比、价位下跌和成交比例变化，判断比分市场的热门路径与冷门路径。',
    audience: '比分明细用户',
    status: '专题',
    level: '入门',
    readMinutes: 6,
    category: 'tools',
    updated: '2026-08-01',
    tags: ['比分', '波胆', '价位', '冷门路径'],
    sections: [
      {
        heading: '核心原则',
        body: [
          '比分明细的基础读法是：赔率下跌，同时成交比例上升，说明该比分被市场更重视。它更适合做比分路径和经过比分观察，不适合孤立判断最终赛果。',
        ],
      },
      {
        heading: '先做时间对比',
        body: [
          '进入波胆明细后，上栏通常是即时分布，下栏可以切换为 6 小时前、2 小时前或 10 分钟前。教程建议优先看 6 小时对比，小成交赛事可看 2 小时。',
        ],
        steps: [
          '打开今日足球，进入目标赛事的波胆明细。',
          '把对比下拉切到 6 小时前；小成交比赛可切到 2 小时前。',
          '观察每个比分的赔率箭头和成交比例箭头。',
          '优先筛选赔率下跌、比例上升且成交比例不低的比分。',
        ],
      },
      {
        heading: '价位间隔不是固定数字',
        body: [
          '比分赔率越高，一个价位对应的间隔越大。判断“下跌几个价位”时，不能直接用 0.01 套所有赔率区间。',
        ],
        table: {
          headers: ['赔率区间', '一个价位大约等于'],
          rows: [
            ['1.00-2.00', '0.01'],
            ['2.00-3.00', '0.02'],
            ['3.00-4.00', '0.05'],
            ['4.00-5.00', '0.10'],
            ['5.00-10.00', '0.20'],
            ['10.00-20.00', '0.50'],
            ['20.00-50.00', '1.00'],
            ['50.00 以上', '5.00'],
          ],
        },
      },
      {
        heading: '几个实用判断',
        body: [
          '早盘热门比分和临场热门比分的含义不同。早盘比例很高的比分不一定最终打出，但可能成为比赛“经过”的路径。',
        ],
        bullets: [
          '早盘 6 小时或 2 小时交易比例 20% 以上的热门比分，通常不直接视为最终赛果。',
          '早盘和临场比例都超过 20% 时，更适合作为“可能经过”的比分观察。',
          '即时比例超过 6 小时前一倍，且赔率没有上升，说明该比分或路径值得关注。',
          '冷门路径可看 0-1、0-2 等比分是否较 6 小时前下跌超过 6 个价位，且比例同步上升。',
        ],
      },
    ],
  },
  {
    slug: 'flashq-price',
    title: '闪Q：用因子估算价位合理性',
    summary: '说明如何用闪Q选择因子、比较平均价位与当前必发价位，并在早盘/临场复核变化。',
    audience: '闪Q与学习工具用户',
    status: '专题',
    level: '进阶',
    readMinutes: 5,
    category: 'tools',
    updated: '2026-08-01',
    tags: ['闪Q', '价位', '因子', 'Quantilearn'],
    sections: [
      {
        heading: '闪Q解决什么问题',
        body: [
          '闪Q可以帮助用户从多个因子出发，估算主胜、平局、客胜的基础概率和平均价位，再与当时的必发价位比较，判断当前价位是否偏离合理区间。',
        ],
      },
      {
        heading: '基础操作流程',
        body: [
          '使用闪Q时，先选择必发成交、必发指数、价位、标盘总成交等因子，得到早盘基础概率和三项平均价位。',
        ],
        steps: [
          '选择目标比赛和早盘时间点。',
          '选择必发成交、必发指数、价位、标盘总成交等核心因子。',
          '读取模型给出的主胜、平局、客胜平均价位。',
          '把平均价位与当前必发价位逐项对比。',
          '临场用同一套因子再跑一次，比较价位合理性的变化。',
        ],
      },
      {
        heading: '怎么看结果',
        body: [
          '如果某一项平均价位明显高于当前必发价位，说明当前价格可能偏低；如果平均价位与必发价位接近，说明当前价格更接近模型估算。最终仍需结合后续成交震荡和其他盘口信息复核。',
        ],
        callout: {
          title: '保持同因子复核',
          body: '早盘和临场最好使用相同因子集合，否则两次结果不容易横向比较。',
          tone: 'info',
        },
      },
    ],
  },
]

export const learningPaths: LearningPath[] = [
  {
    title: '新用户先看',
    summary: '先理解 AI 入口、数据口径和必发基础概念。',
    articleSlugs: ['ai-watch-assistant', 'ai-mcp-use-cases', 'data-methods', 'betfair-basics'],
  },
  {
    title: '指数进阶',
    summary: '从必发高级到 Poly，再看竞彩模型和现场数据。',
    articleSlugs: ['betfair-advanced', 'poly-index', 'jc-studio-models', 'live-data-xg'],
  },
  {
    title: '工具专题',
    summary: '适合已经会看主站数据，想快速查某个工具入口的用户。',
    articleSlugs: ['mcp-quickstart', 'correct-score', 'flashq-price', 'watch-condition'],
  },
]

export const glossaryTerms: GlossaryTerm[] = [
  { term: '有效成交', category: '必发', definition: '结合成交量、成交深度、价位和时间后，被认为更能表达市场倾向的成交。' },
  { term: '有效击穿', category: '现场', definition: '成交穿透了足够价差或盘口层级，说明当时主动性较强。不同价位段阈值不同。' },
  { term: '成交深度', category: '必发', definition: '一笔交易在时间片内跨越的价位数量。深度越大，越需要关注背后的盘口承接。' },
  { term: '锁仓', category: '必发', definition: '高指数或高成交后，下一分时成交量环比增长不足，表现为流动性没有继续放大。' },
  { term: '放量', category: '必发', definition: '下一分时成交量明显扩大，说明流动性继续进入，原判断需要重新检查。' },
  { term: '同步', category: '必发', definition: '同一市场内多笔交易发生在相同时间。' },
  { term: '共振', category: '必发', definition: '不同市场在同一时间出现方向一致的有效交易，比单市场同步更有解释力。' },
  { term: '密集价位', category: '必发', definition: '某个市场成交量最集中的价位区间，用于衡量当前大单是否高于或低于主要成交区。' },
  { term: 'PS', category: '时间标记', definition: '首发名单公布前后的特殊时间窗，常与阵容信息导致的合理赔率重估有关。' },
  { term: 'Poly 大热', category: 'Poly', definition: 'Poly 指数进入 90+ 热度区，代表预测市场成交高度集中，但需要结合必发验证真假热度。' },
  { term: 'BP 量比', category: 'Poly', definition: '用于比较必发与 Poly 两端成交或热度关系的观察指标，失衡时要警惕虚热或背离。' },
  { term: 'xG 进球期望', category: '现场', definition: '用现场数据构成的进球期望走势，用于观察赛中进球趋势和后续变化。' },
  { term: '波胆', category: '比分', definition: '正确比分市场。阅读时重点比较赔率变化、成交比例和早盘/临场对比。' },
  { term: '闪Q', category: '工具', definition: '通过选取因子估算基础概率和平均价位，再与当前必发价位比较的学习工具。' },
]

export const supportChecklist = [
  '请优先提供问题原文、发生时间和可见 trace_id。',
  '涉及比赛时提供 match_id、联赛、主客队和开赛时间。',
  '截图或导出内容应先删除 token、Authorization、cookie 和账号敏感信息。',
  '模型、指数和共振仅作市场观察，不构成投注建议或收益承诺。',
  'AI 通知、站内收件箱、邮件和 webhook 可能需要分别开启。',
]

export const aiArticles = helpArticles.filter(article => article.category === 'ai')

export function findArticle(slug: string): HelpArticle | undefined {
  return helpArticles.find(article => article.slug === slug)
}

export function findAiArticle(slug: string): HelpArticle | undefined {
  return aiArticles.find(article => article.slug === slug)
}

export function getArticlePath(article: Pick<HelpArticle, 'category' | 'slug'>): string {
  return article.category === 'ai' ? `/ai/${article.slug}` : `/docs/${article.slug}`
}

export function getCategory(categoryId: HelpCategoryId): HelpCategory | undefined {
  return helpCategories.find(category => category.id === categoryId)
}

export function getRelatedArticles(article: HelpArticle, limit = 3): HelpArticle[] {
  return helpArticles
    .filter(candidate => candidate.slug !== article.slug)
    .map(candidate => {
      const sharedTags = candidate.tags.filter(tag => article.tags.includes(tag)).length
      const sameCategory = candidate.category === article.category ? 2 : 0
      return { article: candidate, score: sharedTags + sameCategory }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title, 'zh-Hans-CN'))
    .slice(0, limit)
    .map(item => item.article)
}
