<script setup lang="ts">
import { onMounted, onBeforeMount } from "vue";
import { usePreferencesStore } from "@/stores/preferences";
const preferencesStore = usePreferencesStore();

onBeforeMount(async () => {
  const doc = document.documentElement;
  doc.dataset.theme = "oneDark";
  await preferencesStore.init();
});

onMounted(async () => {});
</script>

<template>
  <router-view class="router-view" />
</template>
<style scoped lang="scss"></style>
