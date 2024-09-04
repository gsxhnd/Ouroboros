<template>
  <div class="content-pane" ref="dropZoneRef">
    <ContentHeader />
    <div class="content">
      <router-view></router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeMount, onMounted, onUnmounted, ref, watch } from "vue";
import { userFolderStore } from "@/stores/folder";
import { useFileStore } from "@/stores/file";
import ContentHeader from "./header/ContentHeader.vue";

import { useDropZone } from "@vueuse/core";

const dropZoneRef = ref<HTMLDivElement>();
const folderStore = userFolderStore();
const fileStore = useFileStore();
const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop,
});

const watcher = watch(isOverDropZone, (nValue, oValue) => {
  console.log(nValue, oValue);
});

folderStore.$subscribe((_mutation, state) => {
  if (state.selectedFolderId == 0) return;
  fileStore.getFiles(state.selectedFolderId);
  console.log(fileStore.files);
});

onBeforeMount(async () => {});

onMounted(async () => {});

onUnmounted(() => {
  watcher();
});

function onDrop(files: File[] | null) {
  console.log(files);
}
</script>

<style scoped lang="scss">
.content-pane {
  height: 100%;
  background-color: var(--app-pane-background-1);
  .content {
    padding: 5px;
    height: calc(100% - var(--app-header-height));
    overflow: auto;
  }
}
</style>
