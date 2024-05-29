<template>
  <Splitter :pt="{}">
    <SplitterPanel
      :min-size="15"
      :size="15"
      class="flex align-items-center justify-content-center"
    >
      <left-pane></left-pane>
    </SplitterPanel>
    <SplitterPanel
      :min-size="0"
      :size="75"
      class="flex align-items-center justify-content-center"
    >
      <content-pane></content-pane>
    </SplitterPanel>
    <SplitterPanel
      :min-size="15"
      :size="15"
      class="flex align-items-center justify-content-center"
    >
      <right-pane></right-pane>
    </SplitterPanel>
  </Splitter>
</template>

<script setup lang="ts">
import LeftPane from "./LeftPane.vue";
import RightPane from "./RightPane.vue";
import ContentPane from "./ContentPane.vue";

import Splitter from "primevue/splitter";
import SplitterPanel from "primevue/splitterpanel";
</script>

<style scoped lang="less">
.p-splitter {
  height: 100vh;
  border: none;
}
</style>
