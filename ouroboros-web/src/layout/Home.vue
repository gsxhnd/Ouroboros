<template>
  <Splitter :pt="{}" @resizeend="onResizeEnd" @resize="onResizeEnd">
    <SplitterPanel
      :minSize="0"
      :size="preferencesStore.getPanelSize.value[0]"
      class="flex align-items-center justify-content-center"
      :style="{ display: preferencesStore.showSidePanel ? '' : 'none' }"
    >
      <left-pane></left-pane>
    </SplitterPanel>
    <SplitterPanel
      :minSize="20"
      :size="preferencesStore.getPanelSize.value[1]"
      class="flex align-items-center justify-content-center"
    >
      <content-pane></content-pane>
    </SplitterPanel>
    <SplitterPanel
      :minSize="0"
      :size="preferencesStore.getPanelSize.value[2]"
      class="flex align-items-center justify-content-center"
      :style="{ display: preferencesStore.showSidePanel ? '' : 'none' }"
    >
      <right-pane></right-pane>
    </SplitterPanel>
  </Splitter>
</template>

<script setup lang="ts">
import Splitter, { SplitterResizeEndEvent } from "primevue/splitter";
import SplitterPanel from "primevue/splitterpanel";

import LeftPane from "./LeftPane.vue";
import RightPane from "./RightPane.vue";
import ContentPane from "./ContentPane.vue";
import { usePreferencesStore } from "@/stores/preferences";
const preferencesStore = usePreferencesStore();

async function onResizeEnd(e: SplitterResizeEndEvent) {
  console.log(e);
  await preferencesStore.resizeSidePanel(e.sizes);
}
</script>

<style scoped lang="less">
.p-splitter {
  height: 100vh;
  border: none;
}
</style>
