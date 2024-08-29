<template>
  <div class="content-pane">
    <content-title-bar></content-title-bar>
    <div class="content">
      <router-view></router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeMount, onMounted } from "vue";
import { userFolderStore } from "@/stores/folder";
import { useFileStore } from "@/stores/file";
import ContentTitleBar from "@/components/titlebar/ContentTitleBar.vue";

const folderStore = userFolderStore();
const fileStore = useFileStore();

folderStore.$subscribe((_mutation, state) => {
  if (state.selectedFolderId == 0) return;
  fileStore.getFiles(state.selectedFolderId);
  console.log(fileStore.files);
});

onBeforeMount(async () => {});

onMounted(async () => {});
</script>

<style scoped lang="less">
.content-pane {
  height: 100%;
  background-color: var(--p-bg-2);
  .content {
    height: calc(100% - var(--app-header-height));
    overflow: auto;
  }
}
</style>
