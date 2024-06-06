<template>
  <div class="content-pane">
    <content-title-bar></content-title-bar>
    <router-view></router-view>
  </div>
</template>

<script setup lang="ts">
import ContentTitleBar from "@/components/titlebar/ContentTitleBar.vue";
</script>

<style scoped lang="less">
.content-pane {
  height: 100%;
  background-color: rgb(55, 56, 60);
}
</style>
