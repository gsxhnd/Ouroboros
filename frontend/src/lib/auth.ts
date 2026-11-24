import { create } from "zustand"

/**
 * 访问令牌（server 模式绑定非回环地址时后端要求 Bearer token）。
 * token 存在 localStorage；从未收到 401 时（桌面、本机回环）不做任何事。
 */
const TOKEN_KEY = "ourboros.token"

type AuthState = {
  /** 服务端要求鉴权（收到过 401）时为 true，由 TokenGate 读取。 */
  required: boolean
  markUnauthorized: () => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  required: false,
  markUnauthorized: () => set({ required: true }),
  reset: () => set({ required: false }),
}))

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/** 保存 token 并刷新页面，让所有 store 用新凭证重新拉取数据。 */
export function saveAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim())
  window.location.reload()
}
