// 运行环境检测：一套同时覆盖「浏览器」与「Wails 桌面壳」的操作系统判定。
//
// 桌面壳：加载页面时 URL 会带上 ?platform=<GOOS>（cmd/desktop/main.go），
// 以它为权威信号。react-router 的客户端导航与 `/` → `/tasks` 的重定向都
// 会把参数从地址栏抹掉，而 GUI 内刷新页面（Cmd+R）会重新执行本模块，
// 因此首次读到参数时同步写入 localStorage：参数丢失后（刷新、直达子路径）
// 凭存储值恢复桌面布局。Wails 注入的 window._wails.environment 更权威，
// 但它要等导航完成（WebViewDidFinishNavigation）才执行，无法同步决定
// 首屏渲染，故不依赖。
//
// 浏览器：优先读 navigator.userAgentData.platform（Chromium 系，不受 UA
// 冻结影响），否则解析 navigator.userAgent。
// 注意 iPad 桌面模式的 UA 自称 Macintosh，会被判成 macos——对快捷键提示
// 等用途反而是正确行为（外接键盘同样有 ⌘ 键）。

/** 应用关心的操作系统枚举；识别不了的统一归为 unknown。 */
export type Os = "macos" | "windows" | "linux" | "android" | "ios" | "unknown"

const PLATFORM_STORAGE_KEY = "ourboros:platform"

const paramPlatform = new URLSearchParams(window.location.search).get(
  "platform"
)

if (paramPlatform) {
  try {
    localStorage.setItem(PLATFORM_STORAGE_KEY, paramPlatform)
  } catch {
    // localStorage 被禁用（隐私模式等）时忽略，本次会话仍以查询参数为准。
  }
}

function readStoredPlatform(): string | null {
  try {
    return localStorage.getItem(PLATFORM_STORAGE_KEY)
  } catch {
    return null
  }
}

/** 桌面壳的 GOOS（darwin / windows / linux…），浏览器为 null。 */
const desktopPlatform = paramPlatform ?? readStoredPlatform()
export const isDesktop = desktopPlatform !== null

/** Go 的 GOOS 名称 → 应用侧的操作系统枚举。 */
function goosToOs(goos: string): Os {
  switch (goos) {
    case "darwin":
      return "macos"
    case "windows":
      return "windows"
    case "linux":
      return "linux"
    case "android":
      return "android"
    case "ios":
      return "ios"
    default:
      return "unknown"
  }
}

type NavigatorWithUaData = Navigator & {
  userAgentData?: { platform?: string }
}

/** 浏览器侧判定：UAData.platform 优先，回退到 UA 字符串解析。 */
function detectBrowserOs(): Os {
  const uaData = (navigator as NavigatorWithUaData).userAgentData
  const source = (uaData?.platform ?? navigator.userAgent).toLowerCase()
  // 顺序即优先级：手机系统先于桌面（Android UA 同时含 "linux"）。
  if (/iphone|ipad|ipod/.test(source)) return "ios"
  if (/android/.test(source)) return "android"
  if (/win/.test(source)) return "windows"
  if (/mac/.test(source)) return "macos"
  if (/linux|cros/.test(source)) return "linux"
  return "unknown"
}

/**
 * 当前操作系统。桌面壳与浏览器共用同一份判定结果：
 * 桌面壳以注入的 GOOS 为准，浏览器按 UA 推断。
 */
export const os: Os = isDesktop
  ? goosToOs(desktopPlatform ?? "unknown")
  : detectBrowserOs()

/** 操作系统判定（含浏览器访问），用于快捷键提示等与壳形态无关的差异。 */
export const isMacOs = os === "macos"

/** 桌面壳 + 操作系统的组合判定，用于窗口形态相关的布局差异。 */
export const isMacDesktop = isDesktop && isMacOs

/** 系统托盘弹出的小面板：同一套前端，通过 ?view=tray 切换到精简视图。 */
export const isTrayView =
  new URLSearchParams(window.location.search).get("view") === "tray"
