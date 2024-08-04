<script setup lang="ts">
import { onMounted } from "vue";
import { usePreferencesStore } from "@/stores/preferences";
const preferencesStore = usePreferencesStore();

onMounted(async () => {
  console.log("onMount");
  await preferencesStore.getPreferences();
  console.log("onMount end");
});
</script>

<template>
  <router-view class="router-view" />
</template>

<style scoped></style>
