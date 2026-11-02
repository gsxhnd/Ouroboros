// 检测运行环境：桌面壳会通过 URL 查询参数带上平台
// （cmd/desktop/main.go 中 `?platform=<GOOS>`），浏览器直连则没有该参数。
const platform = new URLSearchParams(window.location.search).get("platform")

export const desktopPlatform = platform
export const isDesktop = platform !== null
export const isMacDesktop = platform === "darwin"
