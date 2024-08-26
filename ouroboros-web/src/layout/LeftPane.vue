<template>
  <div class="left-pane">
    <left-title-bar></left-title-bar>
    <splitpanes horizontal style="height: 100%">
      <pane min-size="10" class="file">
        <tree-file></tree-file>
      </pane>
      <pane min-size="10" class="tag">
        <div class="tag-header">
          <span>{{ $t("message.Tag") }}</span>
        </div>
        <tag />
      </pane>
      <pane min-size="10" class="search">
        <div class="search-header">
          <span>{{ $t("message.SmartSearch") }}</span>
        </div>
        <smart-search />
      </pane>
    </splitpanes>
  </div>
</template>

<script setup lang="ts">
import LeftTitleBar from "@/components/titlebar/LeftTitleBar.vue";
import TreeFile from "@/components/TreeFile.vue";
import Tag from "@/components/Tag.vue";
import SmartSearch from "@/components/SmartSearch.vue";

import { Splitpanes, Pane } from "splitpanes";
import { ref, onMounted } from "vue";

onMounted(() => {});
</script>

<style scoped lang="less">
.left-pane {
  height: 100vh;
  background-color: var(--p-bg-1);
  .tag {
    padding: 2px;
    flex-direction: column;
    display: flex;
    .tag-header {
      height: 30px;
      display: flex;
      align-items: center;
    }
  }
}
</style>
