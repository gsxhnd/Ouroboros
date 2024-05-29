<template>
  <init-title-bar></init-title-bar>
  <div class="card">
    <Button label="Primary" outlined @click="open" />
    <input type="file" webkitdirectory directory />
  </div>
</template>

<script setup lang="ts">
import InitTitleBar from "@/components/titlebar/InitTitleBar.vue";
import Button from "primevue/button";

async function open() {
  await window.electronAPI.addLibPath();
}
</script>

<style scoped></style>
