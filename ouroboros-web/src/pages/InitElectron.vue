<template>
  <InitHeader />
  <div class="card">
    <!-- <Button label="NewAssetLib" outlined @click="open" /> -->
    <button label="NewAssetLib" outlined @click="open"></button>
    <!-- <Button label="SelectAssetLib" outlined @click="selectPath" /> -->
    <button label="SelectAssetLib" outlined @click="selectPath"></button>
    <input type="file" webkitdirectory directory />
  </div>
</template>

<script setup lang="ts">
import InitHeader from "@/layout/header/InitHeader.vue";
import { useRouter } from "vue-router";
const router = useRouter();

async function open() {
  await window.electronAPI
    .newAssetLibPath("tet")
    .then(() => {
      router.replace({ name: "Root" });
    })
    .catch((err) => console.log(err));
}

async function selectPath() {
  await window.electronAPI.selectAssetLibPath().then((path) => {
    console.log(path);
    router.replace({ name: "Root" });
  });
}
</script>

<style scoped></style>
