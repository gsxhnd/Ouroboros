<template>
  <div class="content-pane">
    <content-title-bar></content-title-bar>
    <div class="content">
      <router-view></router-view>
    </div>

    <player></player>
  </div>
</template>

<script setup lang="ts">
import { onBeforeMount, onMounted } from "vue";
import Player from "@/components/Player.vue";
import ContentTitleBar from "@/components/titlebar/ContentTitleBar.vue";

onBeforeMount(async () => {});

onMounted(async () => {});
</script>

<style scoped lang="less">
.content-pane {
  height: 100%;
  background-color: rgb(55, 56, 60);
  .content {
    height: 100%;
    overflow: auto;
  }
}
</style>
