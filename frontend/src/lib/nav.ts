import {
  FolderOpenIcon,
  FolderSyncIcon,
  GaugeIcon,
  HardDriveIcon,
  SettingsIcon,
  TerminalSquareIcon,
  type LucideIcon,
} from "lucide-react"

/**
 * 侧边栏与命令面板共享的导航注册表：路由路径、语言键与图标只在这里定义一次。
 * 分组顺序即侧边栏的展示顺序：先是日常操作的「工作区」，再是工具性的「系统」。
 */
export type NavItem = {
  /** 路由路径，同时用作 React Router 的链接与匹配。 */
  path: string
  /** 名称语言键（nav.*），侧边栏与命令面板共用。 */
  labelKey: string
  icon: LucideIcon
}

export type NavGroup = {
  id: string
  /** 分组标题语言键（nav.*）。 */
  labelKey: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "workspace",
    labelKey: "nav.workspace",
    items: [
      {
        path: "/tasks",
        labelKey: "nav.tasks",
        icon: FolderSyncIcon,
      },
      {
        path: "/files",
        labelKey: "nav.files",
        icon: FolderOpenIcon,
      },
      {
        path: "/storages",
        labelKey: "nav.storages",
        icon: HardDriveIcon,
      },
    ],
  },
  {
    id: "system",
    labelKey: "nav.system",
    items: [
      {
        path: "/overview",
        labelKey: "nav.overview",
        icon: GaugeIcon,
      },
      {
        path: "/settings",
        labelKey: "nav.settings",
        icon: SettingsIcon,
      },
      {
        path: "/api",
        labelKey: "nav.api",
        icon: TerminalSquareIcon,
      },
    ],
  },
]

/** 扁平化后的全部导航项，命令面板按此遍历。 */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)
