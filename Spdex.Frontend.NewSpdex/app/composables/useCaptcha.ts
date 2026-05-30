/**
 * 阿里云验证码2.0 接入（Web/H5 V3 架构）。
 * - 动态加载 AliyunCaptcha.js（仅客户端）。
 * - setup() 把验证码绑定到「触发按钮 + 容器」：点按钮弹滑块，通过后在 verify 回调里发业务请求。
 * - 未启用（NUXT_PUBLIC_CAPTCHA_ENABLED!=true 或缺 SceneId）时 enabled=false，调用方走原直连逻辑。
 * 文档：https://help.aliyun.com/zh/captcha/captcha2-0/user-guide/new-architecture-for-web-and-h5-client-access
 */

declare global {
  interface Window {
    AliyunCaptchaConfig?: { region: string, prefix: string }
    initAliyunCaptcha?: (opts: Record<string, unknown>) => void
  }
}

const SCRIPT_URL = 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js'
let scriptPromise: Promise<void> | null = null

function loadScript(region: string, prefix: string): Promise<void> {
  if (import.meta.server) return Promise.reject(new Error('captcha is client-only'))
  if (window.initAliyunCaptcha) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  window.AliyunCaptchaConfig = { region, prefix }
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_URL
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; reject(new Error('AliyunCaptcha.js 加载失败')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

/** verify 回调必须返回的结构：captchaResult=验证码是否通过；bizResult=业务是否成功。 */
export interface CaptchaBizResult {
  captchaResult: boolean
  bizResult: boolean
}

export function useCaptcha() {
  const config = useRuntimeConfig()
  const enabled = computed(() =>
    Boolean(config.public.captchaEnabled) && Boolean(config.public.captchaSceneId))

  /**
   * 绑定验证码到一个按钮 + 容器。返回 cleanup 函数（或 null：未启用/加载失败时降级）。
   * @param verify 滑块通过后触发，收到 captchaVerifyParam，应调后端验签+业务，返回 {captchaResult,bizResult}
   * @param onBizResult 业务最终结果回调（如成功后跳转）
   */
  async function setup(opts: {
    buttonId: string
    elementId: string
    verify: (captchaVerifyParam: string) => Promise<CaptchaBizResult>
    onBizResult: (bizResult: boolean) => void
  }): Promise<(() => void) | null> {
    if (!enabled.value || import.meta.server) return null

    try {
      await loadScript(
        String(config.public.captchaRegion || 'cn'),
        String(config.public.captchaPrefix || ''),
      )
    }
    catch (e) {
      console.error('[captcha] SDK 加载失败，降级为无验证码直连', e)
      return null
    }
    if (!window.initAliyunCaptcha) return null

    let instance: { destroy?: () => void } | null = null
    window.initAliyunCaptcha({
      SceneId: config.public.captchaSceneId,
      mode: 'popup',
      element: `#${opts.elementId}`,
      button: `#${opts.buttonId}`,
      captchaVerifyCallback: opts.verify,
      onBizResultCallback: opts.onBizResult,
      getInstance: (i: { destroy?: () => void }) => { instance = i },
      slideStyle: { width: 320, height: 40 },
      language: 'cn',
    })

    return () => { try { instance?.destroy?.() } catch { /* noop */ } }
  }

  return { enabled, setup }
}
