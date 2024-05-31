<template>
  <init-title-bar></init-title-bar>
  <div class="card">
    <Button label="NewAssetLib" outlined @click="open" />
    <Button label="SelectAssetLib" outlined @click="selectPath" />
    <input type="file" webkitdirectory directory />
  </div>
</template>

<script setup lang="ts">
import InitTitleBar from "@/components/titlebar/InitTitleBar.vue";
import Button from "primevue/button";

async function open() {
  await window.electronAPI.newAssetLibPath("tet");
}

async function selectPath() {
  await window.electronAPI.selectAssetLibPath();
}
</script>

<style scoped></style>
