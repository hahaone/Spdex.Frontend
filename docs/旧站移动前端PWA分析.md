# 旧站移动前端(PWA)分析 — `Proj_spdex_zhishu_pwa-master`

> 目的:为 NewSpdex 移动端/经典版还原旧站口径与功能时提供"旧站长什么样"的速查参考。**纯分析,旧码只读**。
> 源码位置(OneDrive,已授权只读):
> `/Users/timmbp/Library/CloudStorage/OneDrive-Personal/SpdexWorks/A_Group_SVN/Proj_spdex_zhishu_pwa-master/`
> 旧码冻结于 ~2021-05(`May 23 2021` 时间戳),是当年 op1.sp1x2.net / spdex.com 的**手机端 PWA**。整理日期:2026-06。

---

## 0. TL;DR(和新项目的关系)

- 旧手机端 = **Vue 2.6 + vue-router3 + vuex3 + Vue CLI 3** 的 PWA(2021)。新项目 = **Nuxt 4 + Vue 3 + TS**。技术栈完全换代,**不复用旧前端代码**,只参考其**功能边界、数据口径、会员分级、URL/参数约定**。
- 旧站**多后端**(指数 `rain` / 社区 `sns` / 支付 `pay` / 闪Q `quanti` / 实时 `4vs3`)。新系统已把支付/会员/锦囊/社区**本地化**进 Spdex.Core(见根记忆),旧后端清单仅用于"这个功能当年从哪取数"的考古。
- 旧"赛事详情"(`Search.vue` + 一组 widget)就是新移动端详情页的前身:**标盘/欧赔/亚盘/大小球/凯利/内外盘/价位/库存/成交量/核心交易/挂牌/走势** —— 与新详情页 section 高度对应,是还原口径时最值钱的一块。
- 会员 `roleId` 分级(2 免费 / 4 专家 / 5 白金 / 9 专业 / 10 黄金 / 11 翡翠 / 12 红宝石 / 13 彩店)与新系统一致,**免费版"开赛前 6 小时截止"**的闸门也源自这里。

---

## 1. 仓库结构

`Proj_spdex_zhishu_pwa-master/` 下三个并列子项目:

| 子项目 | 是什么 | 说明 |
|---|---|---|
| **`spdex-page`** | **主 PWA(Vue 2)** | 全部功能都在这。下面 §2 起均指它 |
| `spdex-start` | 启动/分流页(纯静态 `index.html` + JS) | 入口,按设备能力把用户**重定向到 `/pstand`(PWA)或 `/pnormal`(降级)**;iOS ≥12 → pstand,iOS <12 → pnormal,安卓默认 pstand |
| `spdex-down` | App 下载落地页(纯静态 HTML) | 蓝色渐变 + 下载按钮,检测 iOS/安卓给安装指引(微信/QQ 内置浏览器引导、iOS 退回 mobileconfig 描述文件);是装不了 PWA 时的原生 App 下载漏斗 |

---

## 2. 技术栈与关键依赖(`spdex-page/package.json`)

- 框架:`vue@2.6` / `vue-router@3.5` / `vuex@3.6` / `@vue/cli-service@3.12`
- HTTP:`axios@0.18`(外加自封装 `HttpRequest` 类)
- 图表:`highcharts@7.2` + `highcharts-vue`(走势图)
- 列表:`mescroll.js`(下拉/上拉无限滚动)、`vue-awesome-swiper`(轮播)
- 移动适配:`lib-flexible` + `postcss-px2rem-exclude`(rem,`remUnit:72`)
- UI:`element-ui@2.15`(devDep,按需 + 主题覆盖 `element-variables.scss`)
- 验证码:`vue-monoplasty-slide-verify`(滑块)、`vue-puzzle-verification`(拼图,备选)、`identify.vue`(canvas 图形码)
- 工具:`moment`、`vue-cookies`、`vue-clipboard2`、`js-md5`、`jquery`(`ProvidePlugin` 全局注入)
- PWA:`@vue/cli-plugin-pwa` + `register-service-worker`

### 双构建(pwa / nopwa)
`npm run build` = `concurrently` 同时跑两套(`vue.config.js`):

| | PWA | 非 PWA(降级) |
|---|---|---|
| env | `VUE_APP_USING_PWA=1`(`.env.pwa`) | `=0`(`.env.nopwa`) |
| publicPath | `/pstand/` | `/pnormal/` |
| outputDir | `dist/spdex-pwa` | `dist/spdex-normal` |
| manifest display | `standalone`(可加桌面) | `browser` |
| Service Worker | 注册(`registerServiceWorker.js`,仅 prod+pwa) | 不注册 |

manifest:`pwa/pstand/manifest.json`(标题"超级指数全能版",theme `#3a3a3a`,bg `#403f61` 紫,192/512 图标);`pwa/pnormal/manifest.json` 同但 `display:browser`。
> 启示:旧站靠 **start 分流 + 双构建** 兼容老 iOS。新项目用 Nuxt SSR + 单构建,无需此机制(但 PWA 图标/主题色口径可参考)。

---

## 3. 多后端架构(`vue.config.js` devServer.proxy)

> 这是最有考古价值的一块:旧站每个功能从哪个后端取数。生产用 nginx 同名前缀转发,dev 用此 proxy。

| 前缀 | 目标(dev) | 职责 | 新系统现状 |
|---|---|---|---|
| `/spdexapi` | `apitest.spdex.com/rain` | **主指数 / 赛事 / 欧赔 / 用户登录** | → 新 NewSpdex 后端(Spdex.Core) |
| `/snsapi`,`/snsPapi` | `sns2/sns.spdex.com` | **社区 / 锦囊(note)/ 名家排行 / 关注 / 实名** | 已本地化进 Core(锦囊 SQL 账本等) |
| `/payapi`,`/paymapi` | `paytest.spdex.com/...` | **支付 / 会员 / 微信·QQ 登录回调**;`paymapi` 用 `md5(u+key)` 签 path | 已本地化(`NewSpdexNativePaymentGateway` 直连官方网关) |
| `/flashqapi` | `quanti.spdex.com/rain` | **闪Q 量化模型**(`api/mymodels`) | 独立闪Q 项目(ql.spdex.com) |
| `/4vs3api` | `ws.4vs3.com:8080` | **实时比分**(`/sp/App/f/w`) | 新系统走 BSW inplay |
| `/oss`,`/rtmposs` | 阿里云 OSS(北京/杭州) | 图片 / 视频资源 | — |

`rain` 是旧主后端 app 名(= 现 `Spdex.Api` 的部署名);很多新后端控制器是它的还原。

---

## 4. 路由总表(`src/router.js`)

无 `router.beforeEach` 全局守卫;鉴权在 **`main.js` 的"需登录路径名单" + `App.vue.checkCookie()`** 里做(见 §6)。

**免登录可浏览**:`/matches`、`/about`、`/recommend/history`。其余多数需登录。

| Path | 组件(src/views) | 用途 |
|---|---|---|
| `/` | `main.vue` | **主壳**:顶部 6 频道 tab + 底部 footer |
| `/matches` | `league/MatchList.vue` | 赛事列表(免登录) |
| `/search` `/share` `/tutorial` | `match/Search.vue` | **赛事详情(核心)**,三路由复用同组件(搜索结果/分享页/教程页) |
| `/details` | `match/FootballDetailsPage.vue` | 欧赔/亚盘/大小球**明细表**(点开展开 1 小时历史+赔付变化) |
| `/trend` | `match/SinglePageChart.vue` | **全屏走势图**(Highcharts K线+量,横屏) |
| `/login` `/reg` `/forgetPass` `/resetPass` `/updatePass` | `system/*` | 登录/注册/找回/改密 |
| `/account` | `system/account.vue` | 账户(资料/会籍/锦囊余额) |
| `/payMember` `/paySilkbag` | `system/pay/{member,silkbag}.vue` | 会员升级 / 锦囊充值 |
| `/noticeSet` `/noticeLogs` `/silklogs` `/feedback` `/about` | `system/*` | 通知设置/通知记录/锦囊记录/反馈/关于 |
| `/thirdAuth` `/wxLogin` `/thSetPass` `/bindMobile` `/spdexBind` | `system/*` | 第三方登录(QQ/微信/微博)+ 绑定 |
| `/homepage/my` | `homepage/my.vue` | 我的主页(4 tab:往绩胜率/特别关注/我的模型/我的订阅) |
| `/author` `/modelDetail` | `homepage/*` | 名家公开主页 / 模型详情 |
| `/noterank` | `noterank/index.vue` | 名家榜(综合榜/胜率榜) |
| `/recommend/history` | `recommend/HistoryRecommendPage.vue` | 历史推荐 + 命中率饼图 |
| `/realauth` `/realVerify` `/real/mobile` `/real/pass` `/real/resetpass` `/real/bankcard` | `realauth/*` | **实名 KYC 流程**(身份/手机/交易密码/银行卡,用于提现) |

---

## 5. 主壳与导航

- **`src/views/main.vue`**:顶部深色(`#3a3a3a`)横向滚动 tab,6 频道(用 sessionStorage 记当前):
  | 频道 | 组件 | 子 tab |
  |---|---|---|
  | 热门 | `hot/index.vue` | 笔记Top5 / 成交Top5 / 单注Top5 / 媒体Top5 |
  | 推荐 | `recommend/index.vue` | 单场推荐 / 已购推荐 |
  | 关注 | `focus/index.vue` | 已关注作者最新笔记 / 最爱赛事 |
  | 联赛 | `league/LeagueSelectionList.vue` | 按联赛筛选 |
  | 时段 | `league/TimeSelectionList.vue` | 按开赛时间窗筛选 |
  | 异动 | `unusual/UnusualList.vue` | 赔率异动(类型/方向/数值) |
- **`components/footer.vue`**(底部固定 100px):搜索框(`#球队` 或 `#JC赛事号`)+ 榜单图标(→`/noterank`)+ 用户图标(→`/homepage/my` 或 `/login`,新粉丝红点)。
- **`App.vue`**(~700 行)还托管全局弹窗:PWA 加桌引导、注册成功(+50 积分)、安装指引、版本更新、分享复制、iOS<12 不支持、单场解锁支付确认;并 `provide` 给子组件:`reload / checkCookie / freeUserTip / shareApp / showVersionTip`。

---

## 6. 数据层与鉴权(还原口径重点)

### axios 封装(`src/libs/axios.js` `HttpRequest` + `request.js` 导出 `$ajax`)
- **每个请求自动追加** `?app=a&version=1.01&dateformat=iso8601`(app 标识/版本/日期格式)。
- **三个 token 头**:`access_token: 'Bearer '+jwtToken`、`token`、`accessToken`;公开端点可 `withoutToken` 跳过。
- 原生 App 内(`$isInApp`)再追加 `deviceToken/tokenType/devId`(推送)。
- **响应拦截错误码**:`11003`=异地登录(弹窗+清用户+跳登录)、`11001`=token 过期(清+跳)、HTTP 401/403=未授权。
- `main.js` 暴露各后端基址原型:`$baseUrl(/spdexapi)`、`$snsUrl`、`$snsPUrl`、`$payUrl`、`$paymUrl`、`$flashQUrl`、`$4vs3Url`、`$ossUrl`。

### 登录 / token / cookie
- 登录:`GET /spdex/user/login/v2?username=&password=md5(明文)`(**密码仅 MD5,无请求级 HMAC 签名**;`paymapi` 的 path 签名是例外)。
- 返回 `userViewer{userId,userName,nickName,roleId,mobileChecked,endDate}` + `jwtToken`(短)+`jwtTokenLong`(长,30天)+`token`。
- **vuex(`store.js`)** 极简:`userInfo` + `refreshToken`,actions `saveUser/clearUser`,getters 懒从 cookie 兜底。
- **cookie**(vue-cookies):`userInfo`(会话)、`refreshToken`(30天)、`ref_uid`(推荐人)、`wxLoginCode`、`o_form`(支付宝表单 HTML)等。
- **localStorage**:`stars`(收藏赛事 `[{id,dateInMillis}]`,`libs/starStorage.js`)、`tokenBind`、`STORAGE_LOCAL_FREE_TIP/INSTALL_TIP`(弹窗免打扰)。
- **`App.vue.checkCookie()`** 每次切路由跑:无 `userInfo` 但有 `refreshToken` → 自动续期 `GET /spdex/user/login/v2/renew?userId=&jwt=`;都无且该页需登录 → 跳 `/login`;并按 roleId 设默认频道。

### 会员分级(`roleId`,与新系统一致)
| roleId | 版本 | 关键权限 |
|---|---|---|
| 2 | 免费版 | **仅看开赛前 ≥6 小时的赛事**;无锦囊/模型/价位 |
| 4 | 专家版 | 专家内容 |
| 5 | 白金版 | 价位(`/data/r/cs/group`)、进阶分析 |
| 9 | 专业版 | 专业模型 |
| 10 | 黄金版 | 模型门槛(≥10/≥5) |
| 11 | 翡翠版 | 高级 |
| 12 | 红宝石版 | 高级 |
| 13 | 彩店版 | 价位(同白金) |
> 免费版"6 小时闸门"在 `App.vue`/`TipsLoadingView.vue`/`Search.vue` 多处;新系统对应"免费版 24h 上限 + 6h 锁 + 实时禁免费"。

### 关键端点(按后端,grep 自旧码)
- **指数主站 `/spdexapi`**:`/spdex/match_detail?keyword=`、`/spdex/r/match_data/sports?hot=|unusual=1|events=|class=`、`/spdex/leagues/sports`、`/spdex/odds/1x2[/trend]`、`/spdex/odds/view/{list,detail}`、`/spdex/price/volumn`、`/data/r/cs/group?id=`(价位)、`/data/r/chart?eid=&hours=3`(走势)、`/rec/r/single*`(推荐)、`/profile/get?uid=`、`/reg/v3`、`/thp/{qq,sina,wechat}/v2`。
- **社区 `/snsapi`**:`/appNote/note/getNotesByEvent/{eid}`、`/rank/rank/{noteRank,noteHit}/{type}`、`/api/*Attention*.aspx`(关注,旧 .aspx)、`/model/bigbet/getOpenGroup`、`/cert/realname/*`(实名)、`/pay/report/getLatestRewardShardLog`。
- **支付 `/payapi`**:`/common/api/getPrices/5.shtml`、`/ali/pay/createOrder.shtml`、`/silkpay/createOrder.shtml`、`/wechat/msg/*`(微信/QQ 登录码)。
- **闪Q `/flashqapi`**:`/api/mymodels[?uid=][/details]`。
- **实时 `/4vs3api`**:`/sp/App/f/w`。

---

## 7. 赛事详情 = 核心(`match/Search.vue` + widgets)

旧站"赛事详情"由 `Search.vue` 编排一组 widget(`src/views/match/widgets/`),**对应新移动端详情各 section**:

| widget | 中文 | 含义(对新项目意义) |
|---|---|---|
| `IndexView.vue` | 指数 tab 容器 | 标盘/欧赔/亚盘/大小球/凯利 切换 |
| `IndexItem.vue` | 单条指数行 | 名称 + 现值 + 初值 + 方差 |
| `InOutView.vue` | **内外盘** | = 新 `InnerOuterPanel`(已还原) |
| `PriceView.vue` | 价位 | 当前赔率/价位 |
| `StockView.vue` | 库存 | 可交易量(= BfStock 挂牌系) |
| `AmountView.vue` | 成交量 | 各侧成交 |
| `CoreTradeTimeView.vue` | 核心交易时段 | 大额成交按时间(= 新核心交易时段) |
| `MajorExchangeView.vue` | 挂牌 | 主交易所挂牌数据 |
| `TrendView.vue` | 走势缩略 | 内嵌迷你走势,点开 → `/trend` 全屏 |
| `TitleView.vue` | 头部 | 队名/时间/联赛 |

`Search.vue` 还含:闪Q 分析入口、超级大注(会员门槛,`/profile/get` + `/model/bigbet/getOpenGroup` 校验)、分享、快速记笔记。
**`FootballDetailsPage.vue`**(`/details`)= 欧赔/亚盘/大小球**明细表**:多公司 1X2 + 初赔 + 凯利 + 返还率,点行展开近 1 小时历史 + 赔付率变化 —— 即新经典版"欧洲指数"页 + 移动端欧赔 section 的前身。

---

## 8. 图表(Highcharts)

- `match/SinglePageChart.vue`:主走势图,K线/折线 + 成交量柱,多 tab(价位档/指数/赔率类型),**强制横屏**,首访教程气泡("抓大注"技巧)。数据 `GET /data/r/chart?eid=&hours=`。
- `homepage/components/chart.vue`:纯 CSS div 占比条(主/平/客分布、亚盘、总进球),非 SVG。
- `recommend/HistoryRecommendPage.vue`:命中率周/月饼图。
> 新项目走势图已自研 SVG(`StaticTrendChart`/`TradeFlowChart`),口径(初值/现值/方差、横屏抓大注)可对照旧站。

---

## 9. 共享组件与 UI 体系

- `components/`:`ToolBar.vue`(顶部返回栏)、`footer.vue`(底栏)、`menu.vue`(右上抽屉)、`TipsLoadingView.vue`(空/错/加载 + 权限/升级弹窗 + 随机段子)、`SplashPage.vue`(启动广告 5s,仅 standalone)、`identify.vue`(canvas 图形码)、`payConfirm.vue`(支付宝/锦囊支付弹窗)、`flashqAd.vue`(闪Q 广告位)、`userBaseInfo.vue`、`formValidator.vue`。
- **rem**:`postcss-px2rem-exclude` `remUnit:72`(375px 视口下 `1rem≈72px`,排除 node_modules);配 `lib-flexible`。
- **样式**:less + scss 并存;`element-variables.scss` 改 Element-UI 主题(主色蓝);自托管 `assets/iconfont/`(类名 `el-self-*`,如 `el-self-jiangbei` 奖杯/`el-self-yonghu` 用户)。
- **原生桥**:`window.$App.getDeviceToken()/getTokenType()/getDeviceId()` —— 旧 PWA 套在原生壳里时取推送 token。

---

## 10. 对新项目的意义(怎么用这份文档)

1. **还原功能边界**:某页/某 tab 当年有没有、长啥样 → 查 §4/§5/§7。
2. **还原数据口径**:某指标当年从哪个端点、带哪些参数取 → 查 §6 端点清单 +(更细)直接读对应 `views/*.vue`。
3. **会员/闸门**:roleId 分级与免费版限制 → §6;与新系统会籍策略对齐。
4. **不要照搬**:旧多后端/旧 .aspx 社区端点/旧支付网关**大多已被新系统本地化或替换**(见根记忆"支付/会员已完全本地化"),旧端点仅作"当年怎么做"的参考,**新功能范围以产品决策为准,不由旧码决定**(铁律)。
5. **深挖入口**:需要某模块细节时,按本文件路径直接读旧 `.vue`(OneDrive 只读)。常用:`match/Search.vue`(详情编排)、`match/FootballDetailsPage.vue`(欧赔表)、`match/SinglePageChart.vue`(走势)、`league/MatchList.vue`(列表)、`system/login.vue`(登录/第三方)、`system/pay/*`(支付)。

---

*本文件为旧站考古参考,随需补充。旧码只读,切勿改动旧仓库。*
