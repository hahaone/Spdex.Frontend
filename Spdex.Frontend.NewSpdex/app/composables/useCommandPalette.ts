/**
 * 命令面板(⌘K)开合状态。桌面快速跳转用，全局单例(useState 保证 SSR 安全)。
 */
export function useCommandPalette() {
  const open = useState('cmd-palette-open', () => false)
  return {
    open,
    show: () => { open.value = true },
    hide: () => { open.value = false },
    toggle: () => { open.value = !open.value },
  }
}
