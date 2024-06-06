<template>
  <div class="content-pane">
    <content-title-bar></content-title-bar>
    <span @click="test">{{ $t("message.hello") }}</span>
    <router-view></router-view>
  </div>
</template>

<script setup lang="ts">
import ContentTitleBar from "@/components/titlebar/ContentTitleBar.vue";
import { usePreferencesStore } from "@/stores/preferences";
const preferencesStore = usePreferencesStore();

function test() {
  console.log("change lanugae");
  preferencesStore.changeLanuage("en");
}
</script>

<style scoped lang="less">
.content-pane {
  height: 100%;
  background-color: rgb(55, 56, 60);
}
</style>
