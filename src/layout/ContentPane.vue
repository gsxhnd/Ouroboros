<template>
  <div class="content-pane">
    <content-title-bar></content-title-bar>
    <!-- <router-view></router-view> -->
    <upload></upload>
  </div>
</template>

<script setup lang="ts">
import ContentTitleBar from "@/components/titlebar/ContentTitleBar.vue";
import Upload from "@/components/Upload.vue";
</script>

<style scoped lang="less">
.content-pane {
  height: 100%;
  background-color: rgb(55, 56, 60);
}
</style>
