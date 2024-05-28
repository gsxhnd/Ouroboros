<script setup lang="ts">
import { onMounted } from "vue";
// import { useIpcRenderer } from "@vueuse/electron";
// const ipcRenderer = useIpcRenderer();

onMounted(() => {
  console.log("ping");
  // ipcRenderer.send("ping");
  if (window.electronAPI) {
    window.electronAPI
      .loadPreferences()
      .then((data) => {
        console.log(data);
      })
      .catch((err) => {
        console.error(err);
      });
  }
});
</script>

<template>
  <router-view class="router-view" />
</template>

<style scoped></style>
