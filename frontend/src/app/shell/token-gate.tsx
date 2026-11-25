import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { KeyRoundIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAuthToken, saveAuthToken, useAuthStore } from "@/lib/auth"

/**
 * 访问令牌输入门：server 模式绑定非回环地址且配置了 --auth-token 时，
 * 后端对 /api 返回 401，这里收集 token 并持久化到 localStorage。
 * 回环模式（桌面、本机浏览器）永远不会触发。
 */
export function TokenGate() {
  const required = useAuthStore((state) => state.required)
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [token, setToken] = useState("")

  useEffect(() => {
    if (required && !getAuthToken()) {
      // 已有 token 仍然弹出门：说明当前 token 无效，让用户重新输入。
      inputRef.current?.focus()
    }
  }, [required])

  if (!required) {
    return null
  }

  const submit = () => {
    if (token.trim()) {
      saveAuthToken(token)
    }
  }

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent className="w-[min(92vw,24rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4" />
            {t("auth.title")}
          </DialogTitle>
          <DialogDescription>{t("auth.description")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <Label htmlFor="ourboros-token">{t("auth.tokenLabel")}</Label>
          <Input
            id="ourboros-token"
            ref={inputRef}
            type="password"
            autoComplete="off"
            value={token}
            placeholder={t("auth.placeholder")}
            onChange={(event) => setToken(event.target.value)}
          />
        </form>
        <DialogFooter>
          <Button size="sm" disabled={!token.trim()} onClick={submit}>
            {t("auth.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
