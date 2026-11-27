import { Children, useEffect, useRef, useState, type ReactNode } from "react"
import { useLocation } from "react-router"
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "motion/react"

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * 路由切换时的淡入。首次进入不播，避免刷新时主区先空白再出现。
 * 系统开了「减少动态效果」时直接切页。
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const reduced = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className="flex min-h-0 flex-1 flex-col"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduced ? undefined : { opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

const item = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: EASE },
  },
}

/** 列表第一次出现时逐项升起。之后增删不再重播整列。 */
export function Stagger({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  if (reduced) {
    return <div className="flex flex-col gap-3">{children}</div>
  }
  return (
    <motion.div
      className="flex flex-col gap-3"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.045 } } }}
    >
      {Children.map(children, (child) =>
        child ? <motion.div variants={item}>{child}</motion.div> : null
      )}
    </motion.div>
  )
}

/** 数字从当前值缓动到新值，用在概览的计数上。 */
export function CountUp({ value }: { value: number }) {
  const reduced = useReducedMotion()
  const current = useRef(value)
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    const from = current.current
    if (reduced || from === value) {
      current.current = value
      setDisplay(value)
      return
    }
    const controls = animate(from, value, {
      duration: 0.55,
      ease: EASE,
      onUpdate: (next) => {
        const rounded = Math.round(next)
        current.current = rounded
        setDisplay(rounded)
      },
    })
    return () => controls.stop()
  }, [reduced, value])

  return <span className="tabular-nums">{display}</span>
}
