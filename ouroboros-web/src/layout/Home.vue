<template>
  <splitpanes style="height: 100vh">
    <pane min-size="10" size="20" class="">
      <left-pane></left-pane>
    </pane>
    <pane min-size="10" size="40" class="">
      <content-pane></content-pane>
    </pane>
    <pane min-size="10" size="20" class="">
      <right-pane></right-pane>
    </pane>
  </splitpanes>
</template>

<script setup lang="ts">
import { Splitpanes, Pane } from "splitpanes";

import LeftPane from "./LeftPane.vue";
import RightPane from "./RightPane.vue";
import ContentPane from "./ContentPane.vue";
// import { usePreferencesStore } from "@/stores/preferences";
// const preferencesStore = usePreferencesStore();
</script>

<style scoped lang="less"></style>
