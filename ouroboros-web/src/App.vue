<script setup lang="ts">
import { onMounted } from "vue";
import { usePreferencesStore } from "@/stores/preferences";
import DynamicDialog from "primevue/dynamicdialog";
const preferencesStore = usePreferencesStore();

onMounted(async () => {
  console.log("onMount");
  await preferencesStore.getPreferences();
  console.log("onMount end");
});
</script>

<template>
  <DynamicDialog class="preference-dialog" />
  <router-view class="router-view" />
</template>

<style scoped></style>
