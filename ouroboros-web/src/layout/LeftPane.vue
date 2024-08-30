<template>
  <div class="left-pane">
    <LeftTitleBar />
    <splitpanes horizontal style="height: 100%">
      <pane min-size="10" class="file">
        <FileTree />
      </pane>
      <pane min-size="10" class="tag-pane">
        <div class="tag-header">
          <span>{{ $t("message.Tag") }}</span>
        </div>
        <tag />
      </pane>
      <pane min-size="10" class="search">
        <div class="search-header">
          <span>{{ $t("message.SmartSearch") }}</span>
        </div>
        <SmartSearch />
      </pane>
    </splitpanes>
  </div>
</template>

<script setup lang="ts">
import LeftTitleBar from "@/components/titlebar/LeftTitleBar.vue";
import FileTree from "@/components/FileTree.vue";
import Tag from "@/components/Tag.vue";
import SmartSearch from "@/components/SmartSearch.vue";

import { Splitpanes, Pane } from "splitpanes";
import { ref, onMounted } from "vue";

onMounted(() => {});
</script>

<style scoped lang="scss">
.left-pane {
  height: 100vh;
  background-color: var(--app-pane-background-2);
  .tag-pane {
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
