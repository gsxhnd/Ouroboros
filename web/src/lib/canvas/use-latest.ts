import { useLayoutEffect, useRef } from "react"

/**
 * 返回一个始终指向最新值的稳定引用。
 * 事件回调通过它读取最新数据，本身可以保持引用不变，从而让 memo 组件不被重复渲染。
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
