<template>
  <div class="left-pane">
    <LeftHeader />
    <splitpanes horizontal style="height: 100%">
      <pane min-size="5" class="file-pane">
        <FileTreeHeader />
        <FileTree />
      </pane>
      <pane min-size="5" class="tag-pane">
        <div class="tag-header">
          <span>{{ $t("message.Tag") }}</span>
        </div>
        <Tag />
      </pane>
      <pane min-size="5" class="search-pane">
        <SmartSearchHeader />
        <div class="search-header">
          <span>{{ $t("message.SmartSearch") }}</span>
        </div>
        <SmartSearch />
      </pane>
    </splitpanes>
  </div>
</template>

<script setup lang="ts">
import LeftHeader from "./header/LeftHeader.vue";
import FileTree from "@/components/FileTree.vue";
import FileTreeHeader from "@/components/FileTreeHeader.vue";

import Tag from "@/components/Tag.vue";
import SmartSearchHeader from "@/pages/SmartSearchHeader.vue";
import SmartSearch from "@/pages/SmartSearch.vue";

import { Splitpanes, Pane } from "splitpanes";
import { onMounted } from "vue";

onMounted(() => {});
</script>

<style scoped lang="scss">
$pane-padding-size: var(--app-pane-padding-size);

.left-pane {
  height: 100vh;
  background-color: var(--app-pane-background-2);
  .file-pane {
    padding: $pane-padding-size;
  }
  .tag-pane {
    padding: $pane-padding-size;
  }
  .search-pane {
    padding: $pane-padding-size;
  }
}
</style>
