<template>
  <div class="left-pane">
    <left-title-bar></left-title-bar>
    <tree-file></tree-file>
  </div>
</template>

<script setup lang="ts">
import LeftTitleBar from "@/components/titlebar/LeftTitleBar.vue";
import TreeFile from "@/components/TreeFile.vue";
import { onMounted } from "vue";

onMounted(() => {});
</script>

<style scoped lang="less">
.left-pane {
  padding: 2px;
}
</style>
