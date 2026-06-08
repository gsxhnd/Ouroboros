import { useEffect, useRef } from "react"
import { usePanelRef } from "react-resizable-panels"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useUIStore } from "@/stores/ui"

import { AppHeader } from "./app-header"
import { MainPanel } from "./main-panel"
import { PrimaryPanel } from "./primary-panel"
import { SecondaryPanel } from "./secondary-panel"

const PANEL_IDS = {
  primary: "primary",
  main: "main",
  secondary: "secondary",
} as const

export function AppLayout() {
  const secondaryPanelRef = usePanelRef()
  const inspectorVisibleRef = useRef(useUIStore.getState().inspectorVisible)

  const {
    sidebarWidth,
    inspectorWidth,
    inspectorVisible,
    setSidebarWidth,
    setInspectorWidth,
    setInspectorVisible,
  } = useUIStore()

  useEffect(() => {
    inspectorVisibleRef.current = inspectorVisible
  }, [inspectorVisible])

  useEffect(() => {
    const panel = secondaryPanelRef.current
    if (!panel) {
      return
    }

    if (inspectorVisible) {
      panel.expand()
      return
    }

    panel.collapse()
  }, [inspectorVisible, secondaryPanelRef])

  function handleToggleInspector() {
    setInspectorVisible(!inspectorVisible)
  }

  return (
    <div className="flex h-svh flex-col bg-background text-foreground">
      <AppHeader
        inspectorVisible={inspectorVisible}
        onToggleInspector={handleToggleInspector}
      />

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup
          id="app-layout"
          orientation="horizontal"
          className="h-full"
        >
          <ResizablePanel
            id={PANEL_IDS.primary}
            defaultSize={sidebarWidth}
            minSize={180}
            maxSize={420}
            groupResizeBehavior="preserve-pixel-size"
            onResize={(size) => {
              if (size.inPixels > 0) {
                setSidebarWidth(Math.round(size.inPixels))
              }
            }}
          >
            <PrimaryPanel />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel id={PANEL_IDS.main} minSize={320}>
            <MainPanel />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            id={PANEL_IDS.secondary}
            panelRef={secondaryPanelRef}
            defaultSize={inspectorVisible ? inspectorWidth : 0}
            minSize={240}
            maxSize={520}
            collapsible
            collapsedSize={0}
            groupResizeBehavior="preserve-pixel-size"
            onResize={(size) => {
              if (size.inPixels > 0) {
                setInspectorWidth(Math.round(size.inPixels))
              }

              const visible = size.inPixels > 8
              if (visible !== inspectorVisibleRef.current) {
                inspectorVisibleRef.current = visible
                setInspectorVisible(visible)
              }
            }}
          >
            <SecondaryPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
