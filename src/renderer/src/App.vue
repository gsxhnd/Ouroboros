<script setup lang="ts">
import { onMounted } from "vue";
// import { useIpcRenderer } from "@vueuse/electron";
// const ipcRenderer = useIpcRenderer();

onMounted(() => {
  console.log("ping");
  // ipcRenderer.send("ping");
});
</script>

<template>
  <router-view class="router-view" />
</template>

<style scoped></style>
